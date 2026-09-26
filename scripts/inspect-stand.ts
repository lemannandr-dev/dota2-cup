import { prisma } from '../lib/prisma';

async function main() {
	const tournaments = await prisma.tournament.findMany({
		orderBy: { createdAt: 'desc' },
		take: 8,
		select: {
			id: true,
			title: true,
			status: true,
			prizePool: true,
			prizeStatus: true,
			startAt: true,
			checkInOpensAt: true,
			checkInClosesAt: true,
			createdById: true,
			_count: { select: { applications: true, matches: true } }
		}
	});
	const steamUsers = await prisma.user.findMany({
		where: { steamId: { not: null } },
		select: { id: true, displayName: true, steamId: true, role: true, balance: true, totpEnabledAt: true }
	});
	const teams = await prisma.team.findMany({
		where: { deletedAt: null },
		select: {
			id: true,
			name: true,
			createdById: true,
			members: { where: { confirmed: true, isSubstitute: false }, select: { userId: true, user: { select: { steamId: true } } } }
		}
	});
	console.log(JSON.stringify({ tournaments, steamUsers, teams: teams.map((team) => ({
		id: team.id,
		name: team.name,
		createdById: team.createdById,
		confirmed: team.members.length,
		steam: team.members.filter((member) => member.user.steamId).length
	})) }, null, 2));
}

main()
	.catch((error) => {
		console.error(error);
		process.exit(1);
	})
	.finally(async () => {
		await prisma.$disconnect();
	});
