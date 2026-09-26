import { prisma } from '@/lib/prisma';
import { DomainError } from '@/server/errors';
import { canActForTeam, deputyIdFromMembers } from '@/lib/team-roles';
import { lockParty } from '@/server/party/service';
import { lockTournamentRow } from '@/server/db/advisory-lock';
import { assertEligibleRoster } from '@/server/tournaments/eligibility';

export async function checkInTeam(tournamentId: string, teamId: string, userId: string) {
	return prisma.$transaction(async (db) => {
		await lockTournamentRow(db, tournamentId);
		await lockParty(db, teamId);
		const tournament = await db.tournament.findUnique({ where: { id: tournamentId } });
		if (!tournament) throw new DomainError('Турнир не найден', 404);

		const now = new Date();
		if (tournament.status !== 'CHECK_IN' && tournament.status !== 'REGISTRATION') {
			throw new DomainError('Check-in сейчас недоступен', 400);
		}
		if (tournament.checkInOpensAt && now < tournament.checkInOpensAt) {
			throw new DomainError('Check-in ещё не открыт', 400);
		}
		if (tournament.checkInClosesAt && now > tournament.checkInClosesAt) {
			throw new DomainError('Check-in уже закрыт', 400);
		}

		const application = await db.teamApplication.findUnique({
			where: { teamId_tournamentId: { teamId, tournamentId } },
			include: {
				team: {
					select: {
						createdById: true,
						members: { where: { confirmed: true }, include: { user: { select: { id: true, steamId: true, displayName: true } } } }
					}
				}
			}
	});
	if (!application) throw new DomainError('Заявка не найдена', 404);
	const deputyId = deputyIdFromMembers(application.team.members, application.team.createdById);
	if (!canActForTeam(userId, application.team.createdById, deputyId)) {
		throw new DomainError('Check-in выполняет капитан или заместитель', 403);
	}
	if (application.status === 'CHECKED_IN' || application.status === 'IN_BRACKET') {
		return application;
	}
	if (application.status !== 'APPROVED') {
		throw new DomainError(`Недопустимый статус заявки: ${application.status}`, 400);
	}

	const roster = assertEligibleRoster(application.team.members);
	const updated = await db.teamApplication.update({
		where: { id: application.id },
		data: { status: 'CHECKED_IN', checkedInAt: now, rosterSnapshot: roster.snapshot }
	});
	await db.auditLog.create({
		data: { actorId: userId, action: 'TEAM_CHECKED_IN', entity: 'TeamApplication', entityId: application.id }
	});
	return updated;
	});
}
