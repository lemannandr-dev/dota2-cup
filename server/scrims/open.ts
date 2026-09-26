import { prisma } from '@/lib/prisma';
import { computeReportDeadline } from '@/lib/match-deadline';
import { scrimChallengeRejected, type ScrimGate } from '@/lib/scrim-policy';

export async function openScrimsForTeams(teamIds: string[], exceptChallengeId?: string): Promise<ScrimGate[]> {
	const ids = [...new Set(teamIds)];
	const rows = await prisma.teamChallenge.findMany({
		where: {
			...(exceptChallengeId ? { id: { not: exceptChallengeId } } : {}),
			OR: [{ fromTeamId: { in: ids } }, { toTeamId: { in: ids } }]
		},
		select: { status: true, match: { select: { status: true } } }
	});
	return rows.map((row) => ({ status: row.status, matchStatus: row.match?.status ?? null }));
}

export async function assertTeamsCanChallenge(teamIds: string[], exceptChallengeId?: string) {
	const gates = await openScrimsForTeams(teamIds, exceptChallengeId);
	if (scrimChallengeRejected(gates)) {
		return 'У одной из команд уже есть открытый вызов или скрим.';
	}
	return null;
}

async function scrimBoardId() {
	const existing = await prisma.tournament.findFirst({ where: { scrimBoard: true }, select: { id: true, status: true } });
	if (existing) {
		if (existing.status !== 'LIVE') {
			await prisma.tournament.update({ where: { id: existing.id }, data: { status: 'LIVE' } });
		}
		return existing.id;
	}
	const created = await prisma.tournament.create({
		data: {
			title: 'Скримы арены',
			scrimBoard: true,
			status: 'LIVE',
			prizePool: 0,
			prizeStatus: 'NONE',
			maxTeams: 256,
			startAt: new Date(),
			seriesRules: 'BO1'
		},
		select: { id: true }
	});
	return created.id;
}

export async function openScrimMatch(input: { challengeId: string; fromTeamId: string; toTeamId: string }) {
	const existing = await prisma.teamChallenge.findUnique({
		where: { id: input.challengeId },
		select: { matchId: true, status: true }
	});
	if (existing?.matchId) return existing.matchId;

	const tournamentId = await scrimBoardId();
	const taken = await prisma.match.count({ where: { tournamentId, bracket: 'scrim' } });
	const match = await prisma.match.create({
		data: {
			tournamentId,
			scrim: true,
			bracket: 'scrim',
			round: 1,
			position: taken,
			bestOf: 1,
			status: 'SCHEDULED',
			teamAId: input.fromTeamId,
			teamBId: input.toTeamId,
			reportDeadlineAt: computeReportDeadline(new Date()),
			startedAt: new Date()
		}
	});
	await prisma.teamChallenge.update({
		where: { id: input.challengeId },
		data: { matchId: match.id }
	});
	return match.id;
}
