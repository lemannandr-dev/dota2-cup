import { prisma } from '../lib/prisma';

async function main() {
	const teams = await prisma.team.findMany({
		where: { deletedAt: null },
		select: {
			id: true,
			name: true,
			createdById: true,
			members: { select: { userId: true, user: { select: { id: true, displayName: true, steamId: true } } } }
		},
		take: 20
	});
	const cups = await prisma.tournament.findMany({
		select: { id: true, title: true, status: true, startAt: true, createdById: true },
		orderBy: { createdAt: 'desc' },
		take: 20
	});
	const matches = await prisma.match.findMany({
		where: { winnerTeamId: { not: null } },
		select: {
			id: true,
			tournamentId: true,
			bracket: true,
			nextMatchId: true,
			winnerTeamId: true,
			teamAId: true,
			teamBId: true,
			status: true
		},
		take: 30
	});
	console.log(JSON.stringify({ teams, cups, matches }, null, 2));
}

main()
	.catch((error) => {
		console.error(error);
		process.exit(1);
	})
	.finally(async () => {
		await prisma.$disconnect();
	});
