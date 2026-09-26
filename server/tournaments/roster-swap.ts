import { prisma } from '@/lib/prisma';
import { canSwapTournamentRoster } from '@/lib/access-policy';
import { rosterFromSnapshot } from '@/lib/match-day';
import { decideRosterSwap, pairBlocksRosterSwap } from '@/lib/roster-swap';
import { DomainError } from '@/server/errors';
import { freezeTeamHistoryBeforeSwap } from '@/server/matches/freeze-roster';
import { isTournamentStaff } from '@/server/tournaments/staff';
import type { Role } from '@prisma/client';

export async function swapTournamentRoster(input: {
	tournamentId: string;
	teamId: string;
	outUserId: string;
	inUserId: string;
	actorId: string;
	actorRole: Role;
}) {
	const tournament = await prisma.tournament.findUnique({
		where: { id: input.tournamentId },
		select: { id: true, title: true, status: true }
	});
	if (!tournament) throw new DomainError('Турнир не найден', 404);

	const application = await prisma.teamApplication.findUnique({
		where: { teamId_tournamentId: { teamId: input.teamId, tournamentId: input.tournamentId } },
		include: {
			team: {
				select: {
					id: true,
					name: true,
					createdById: true,
					members: {
						where: { confirmed: true },
						include: { user: { select: { id: true, displayName: true, steamId: true } } }
					}
				}
			}
		}
	});
	if (!application) throw new DomainError('Заявка не найдена', 404);

	const staff = await isTournamentStaff(input.actorId, input.actorRole, input.tournamentId);
	if (!canSwapTournamentRoster(input.actorId, application.team.createdById, staff)) {
		throw new DomainError('Замену делает капитан или судья', 403);
	}

	const incomingMember = application.team.members.find((member) => member.userId === input.inUserId);
	if (!incomingMember) throw new DomainError('Запасной должен быть в этой команде', 400);

	const otherApps = await prisma.teamApplication.findMany({
		where: {
			tournamentId: input.tournamentId,
			teamId: { not: input.teamId },
			status: { notIn: ['REJECTED', 'WITHDRAWN', 'DISQUALIFIED', 'NO_CHECK_IN'] }
		},
		select: { rosterSnapshot: true }
	});
	const incomingOnOtherTeam = otherApps.some((row) =>
		rosterFromSnapshot(row.rosterSnapshot).some((player) => player.userId === input.inUserId)
	);

	const openMatches = await prisma.match.findMany({
		where: {
			tournamentId: input.tournamentId,
			OR: [{ teamAId: input.teamId }, { teamBId: input.teamId }]
		},
		select: {
			id: true,
			status: true,
			teamAId: true,
			teamBId: true,
			rosterA: true,
			rosterB: true,
			teamA: { select: { createdById: true } },
			teamB: { select: { createdById: true } },
			reports: { select: { teamId: true } }
		}
	});
	const pairInProgress = openMatches.some((match) =>
		pairBlocksRosterSwap(
			{
				status: match.status,
				teamAId: match.teamAId,
				teamBId: match.teamBId,
				reportedTeamIds: match.reports.map((row) => row.teamId),
				frozenA: Boolean(match.rosterA),
				frozenB: Boolean(match.rosterB)
			},
			input.teamId
		)
	);

	const decision = decideRosterSwap({
		tournamentStatus: tournament.status,
		applicationStatus: application.status,
		outUserId: input.outUserId,
		incoming: {
			userId: incomingMember.user.id,
			confirmed: incomingMember.confirmed,
			steamId: incomingMember.user.steamId,
			displayName: incomingMember.user.displayName
		},
		currentSnapshot: application.rosterSnapshot,
		incomingOnOtherTeam,
		pairInProgress
	});
	if (!decision.ok) throw new DomainError(decision.error, 400);

	await freezeTeamHistoryBeforeSwap({
		tournamentId: input.tournamentId,
		teamId: input.teamId,
		snapshot: application.rosterSnapshot
	});

	const updated = await prisma.teamApplication.update({
		where: { id: application.id },
		data: { rosterSnapshot: decision.snapshot as object }
	});

	await prisma.auditLog.create({
		data: {
			actorId: input.actorId,
			action: 'ROSTER_SWAPPED',
			entity: 'TeamApplication',
			entityId: application.id,
			payload: { outUserId: decision.out.userId, inUserId: decision.incoming.userId }
		}
	});

	const opponentIds = openMatches
		.filter((match) => !['COMPLETED', 'TECHNICAL'].includes(match.status))
		.map((match) => (match.teamAId === input.teamId ? match.teamB?.createdById : match.teamA?.createdById))
		.filter((id): id is string => Boolean(id));

	const notifyIds = Array.from(
		new Set([decision.out.userId, decision.incoming.userId, ...opponentIds].filter((id) => id !== input.actorId))
	);
	if (notifyIds.length) {
		await prisma.notification.createMany({
			data: notifyIds.map((userId) => ({
				userId,
				type: 'ROSTER_SWAP',
				title: `Замена в составе: ${tournament.title}`,
				body: `В «${application.team.name}» вместо ${decision.out.displayName} выходит ${decision.incoming.displayName}. Уже сыгранные пары не меняются.`,
				linkUrl: `/tournaments/${tournament.id}`
			}))
		});
	}

	return updated;
}
