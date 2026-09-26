import { fetchOpenDotaRankBySteamId } from '../lib/dota-stats';
import { persistOpenDotaRank } from '../server/opendota-rank';
import { storedOpenDotaMmr } from '../lib/dota-rank';
import { prisma } from '../lib/prisma';

async function main() {
	const users = await prisma.user.findMany({
		where: { steamId: { not: null } },
		select: { id: true, displayName: true, steamId: true, openDotaMmr: true, openDotaMmrSource: true }
	});
	const rows = [];
	for (const user of users) {
		if (!user.steamId) continue;
		const live = await fetchOpenDotaRankBySteamId(user.steamId);
		const mmr = storedOpenDotaMmr(live?.mmr, live?.mmrSource);
		if (live && (live.rankTier || mmr)) {
			await persistOpenDotaRank(user.steamId, { rankTier: live.rankTier, leaderboardRank: live.leaderboardRank }, mmr);
		}
		const saved = await prisma.user.findUnique({
			where: { id: user.id },
			select: { openDotaMmr: true, openDotaMmrSource: true, openDotaRankTier: true }
		});
		rows.push({
			id: user.id,
			displayName: user.displayName,
			steamId: user.steamId,
			live,
			saved
		});
	}
	console.log(JSON.stringify(rows, null, 2));
}

main()
	.catch((error) => {
		console.error(error);
		process.exit(1);
	})
	.finally(async () => {
		await prisma.$disconnect();
	});
