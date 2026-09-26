import { prisma } from '@/lib/prisma';
import { rosterFromSnapshot } from '@/lib/match-day';
import { shouldFreezeHistoricalMatch, writeRosterSnapshot } from '@/lib/roster-swap';

function playersJson(snapshot: unknown) {
	const players = rosterFromSnapshot(snapshot).map((row) => ({
		userId: row.userId ?? null,
		steamId: row.steamId ?? null,
		displayName: row.displayName
	}));
	return writeRosterSnapshot(snapshot, players.filter((row): row is { userId: string; steamId: string | null; displayName: string } => Boolean(row.userId)));
}

export async function freezeMatchRostersIfNeeded(matchId: string) {
	const match = await prisma.match.findUnique({
		where: { id: matchId },
		select: { rosterA: true, rosterB: true, teamAId: true, teamBId: true, tournamentId: true }
	});
	if (!match) return;
	if (match.rosterA && match.rosterB) return;

	const apps = await prisma.teamApplication.findMany({
		where: {
			tournamentId: match.tournamentId,
			teamId: { in: [match.teamAId, match.teamBId].filter((id): id is string => Boolean(id)) }
		},
		select: { teamId: true, rosterSnapshot: true }
	});
	const byTeam = new Map(apps.map((row) => [row.teamId, row.rosterSnapshot]));
	await prisma.match.update({
		where: { id: matchId },
		data: {
			rosterA: match.rosterA ?? (match.teamAId ? playersJson(byTeam.get(match.teamAId) ?? null) : undefined),
			rosterB: match.rosterB ?? (match.teamBId ? playersJson(byTeam.get(match.teamBId) ?? null) : undefined)
		}
	});
}

export async function freezeTeamHistoryBeforeSwap(input: {
	tournamentId: string;
	teamId: string;
	snapshot: unknown;
}) {
	const matches = await prisma.match.findMany({
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
			reports: { select: { id: true } }
		}
	});
	const frozen = playersJson(input.snapshot);
	for (const match of matches) {
		if (!shouldFreezeHistoricalMatch(match.status, match.reports.length > 0)) continue;
		const data: { rosterA?: object; rosterB?: object } = {};
		if (match.teamAId === input.teamId && !match.rosterA) data.rosterA = frozen;
		if (match.teamBId === input.teamId && !match.rosterB) data.rosterB = frozen;
		if (Object.keys(data).length === 0) continue;
		await prisma.match.update({ where: { id: match.id }, data });
	}
}
