import { prisma } from '@/lib/prisma';
import { canSubmitTeamApplication } from '@/lib/access-policy';
import { DomainError } from '@/server/errors';
import { assertEligibleRoster } from '@/server/tournaments/eligibility';
import { canJoinWaitlist, countedApplicationStatus } from '@/lib/waitlist';
import { lockParty } from '@/server/party/service';
import { lockTournamentRow } from '@/server/db/advisory-lock';

export async function registerTeam(tournamentId: string, teamId: string, userId: string) {
	return prisma.$transaction(async (db) => {
		await lockTournamentRow(db, tournamentId);
		await lockParty(db, teamId);
		const tournament = await db.tournament.findUnique({
			where: { id: tournamentId },
			include: {
				applications: { select: { status: true } }
			}
	});
	if (!tournament) throw new DomainError('Турнир не найден', 404);
	if (tournament.status !== 'REGISTRATION') throw new DomainError('Регистрация закрыта', 400);
	const counted = tournament.applications.filter((app) => countedApplicationStatus(app.status)).length;
	const waitlisted = canJoinWaitlist({ counted, maxTeams: tournament.maxTeams, tournamentStatus: tournament.status });

	const team = await db.team.findUnique({
		where: { id: teamId },
		include: { members: { include: { user: { select: { id: true, steamId: true, displayName: true } } } } }
	});
	if (!team || team.deletedAt) throw new DomainError('Команда не найдена', 404);
	if (!canSubmitTeamApplication(userId, team.createdById)) throw new DomainError('Заявку подаёт только капитан', 403);

	const existing = await db.teamApplication.findUnique({
		where: { teamId_tournamentId: { teamId, tournamentId } }
	});
	if (existing && !['REJECTED', 'WITHDRAWN', 'DISQUALIFIED'].includes(existing.status)) {
		return existing;
	}

	const roster = assertEligibleRoster(team.members);

	const conflict = await db.teamApplication.findFirst({
		where: {
			tournamentId,
			status: { notIn: ['REJECTED', 'WITHDRAWN', 'DISQUALIFIED'] },
			team: { members: { some: { userId: { in: roster.userIds }, confirmed: true } } }
		},
		include: { team: { select: { name: true } } }
	});
	if (conflict) {
		throw new DomainError(`Игрок уже заявлен в этом турнире за команду ${conflict.team.name}`, 409);
	}

	const application = await db.teamApplication.create({
		data: {
			teamId,
			tournamentId,
			status: waitlisted ? 'WAITLIST' : 'SUBMITTED',
			rosterSnapshot: roster.snapshot
		}
	});
	await db.auditLog.create({
		data: {
			actorId: userId,
			action: waitlisted ? 'WAITLIST_JOINED' : 'TEAM_REGISTERED',
			entity: 'TeamApplication',
			entityId: application.id
		}
	});
	return application;
	});
}

export async function withdrawTeam(tournamentId: string, teamId: string, userId: string) {
	const application = await prisma.teamApplication.findUnique({
		where: { teamId_tournamentId: { teamId, tournamentId } },
		include: { team: { select: { createdById: true } }, tournament: { select: { status: true } } }
	});
	if (!application) throw new DomainError('Заявка не найдена', 404);
	if (!canSubmitTeamApplication(userId, application.team.createdById)) {
		throw new DomainError('Снять заявку может только капитан', 403);
	}
	if (!['REGISTRATION', 'CHECK_IN'].includes(application.tournament.status)) {
		throw new DomainError('Снять заявку уже нельзя', 400);
	}
	if (['IN_BRACKET', 'DISQUALIFIED'].includes(application.status)) {
		throw new DomainError('Команда уже в сетке', 400);
	}
	const updated = await prisma.teamApplication.update({
		where: { id: application.id },
		data: { status: 'WITHDRAWN' }
	});
	await prisma.auditLog.create({
		data: { actorId: userId, action: 'TEAM_WITHDRAWN', entity: 'TeamApplication', entityId: application.id }
	});
	return updated;
}
