import { prisma } from '@/lib/prisma';
import { arenaRatingFromResults } from '@/lib/arena-rating';

export async function recomputeArenaRating(userId: string) {
	const memberships = await prisma.teamMember.findMany({
		where: { userId, confirmed: true },
		select: { teamId: true }
	});
	const teamIds = memberships.map((row) => row.teamId);
	if (!teamIds.length) {
		await prisma.user.update({
			where: { id: userId },
			data: { rating: 1000, ratingGames: 0 }
		});
		return arenaRatingFromResults([]);
	}

	const matches = await prisma.match.findMany({
		where: {
			status: { in: ['COMPLETED', 'TECHNICAL'] },
			winnerTeamId: { not: null },
			teamAId: { not: null },
			teamBId: { not: null },
			OR: [{ teamAId: { in: teamIds } }, { teamBId: { in: teamIds } }]
		},
		select: { teamAId: true, teamBId: true, winnerTeamId: true, finishedAt: true },
		orderBy: [{ finishedAt: 'asc' }, { createdAt: 'asc' }]
	});

	const results = matches.map((match) => {
		const teamId = teamIds.includes(match.teamAId as string) ? match.teamAId : match.teamBId;
		return { won: match.winnerTeamId === teamId };
	});
	const summary = arenaRatingFromResults(results);
	await prisma.user.update({
		where: { id: userId },
		data: { rating: summary.rating, ratingGames: summary.games }
	});
	return summary;
}

export async function recomputeArenaRatingsForTeams(teamIds: Array<string | null | undefined>) {
	const ids = [...new Set(teamIds.filter((id): id is string => Boolean(id)))];
	if (!ids.length) return;
	const members = await prisma.teamMember.findMany({
		where: { teamId: { in: ids }, confirmed: true },
		select: { userId: true }
	});
	for (const row of [...new Set(members.map((member) => member.userId))]) {
		await recomputeArenaRating(row);
	}
}
