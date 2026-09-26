const { PrismaClient } = require('@prisma/client');
const { readFileSync } = require('fs');
const path = require('path');

const PLUS_LEVEL_TOTAL_XP = [
	0, 50, 350, 750, 1250, 1850, 2750, 3750, 4850, 6050, 7350, 8750, 10450, 12250, 14150, 16150,
	18250, 20450, 22950, 25550, 28250, 31050, 33950, 36950, 40050, 46850, 50850, 55050, 59450, 64050, 72050
];

function plusFromXp(xp, officialLevel) {
	let level = 1;
	for (let next = 1; next < PLUS_LEVEL_TOTAL_XP.length; next += 1) {
		if (xp >= PLUS_LEVEL_TOTAL_XP[next]) level = next;
		else break;
	}
	if (officialLevel >= 1 && officialLevel <= 30) level = officialLevel;
	const nextLevelXp = level >= 30 ? null : PLUS_LEVEL_TOTAL_XP[level + 1];
	return { level, xpToNext: nextLevelXp === null ? null : Math.max(0, nextLevelXp - xp) };
}

async function main() {
	const prisma = new PrismaClient();
	const payload = JSON.parse(readFileSync(path.join(__dirname, '.official-plus.json'), 'utf8'));
	const steamId = String(BigInt(payload.accountId) + 76561197960265728n);
	const user = await prisma.user.findUnique({ where: { steamId }, select: { id: true, displayName: true } });
	if (!user) throw new Error(`User ${steamId} not found`);
	const capturedAt = new Date();
	await prisma.dotaClientSnapshot.create({
		data: {
			userId: user.id,
			payload: {
				helperVersion: 'public-replay',
				detectedAt: capturedAt.toISOString(),
				steamDetected: true,
				dotaDetected: true,
				heroProgressPresent: payload.heroes.length > 0,
				officialHeroCount: payload.heroes.length,
				publicReplayMeta: payload.public
			}
		}
	});
	for (const hero of payload.heroes) {
		const plus = plusFromXp(hero.xp, hero.level);
		const existing = await prisma.dotaHeroProgress.findUnique({
			where: { userId_heroId: { userId: user.id, heroId: hero.heroId } }
		});
		if (existing && existing.xp > hero.xp) continue;
		await prisma.dotaHeroProgress.upsert({
			where: { userId_heroId: { userId: user.id, heroId: hero.heroId } },
			create: {
				userId: user.id,
				heroId: hero.heroId,
				level: plus.level,
				xp: hero.xp,
				xpToNext: plus.xpToNext,
				source: hero.source || 'replay',
				capturedAt,
				payload: hero
			},
			update: {
				level: plus.level,
				xp: hero.xp,
				xpToNext: plus.xpToNext,
				source: hero.source || 'replay',
				capturedAt,
				payload: hero
			}
		});
	}
	const count = await prisma.dotaHeroProgress.count({ where: { userId: user.id } });
	console.log(JSON.stringify({ user: user.displayName, officialHeroCount: count, heroes: payload.heroes }, null, 2));
	await prisma.$disconnect();
}

main().catch((error) => {
	console.error(error);
	process.exit(1);
});
