import { prisma } from '@/lib/prisma';
import { plusProgressFromXp } from '@/lib/dota-plus-hero';

export type OfficialHeroInput = {
	heroId: number;
	level: number;
	xp: number;
	xpToNext?: number | null;
	matchId?: number | null;
	source?: string;
};

export function shouldReplaceOfficialXp(existingXp: number | null | undefined, nextXp: number) {
	if (existingXp == null) return true;
	return nextXp >= existingXp;
}

export async function saveOfficialHeroProgress(
	userId: string,
	heroes: OfficialHeroInput[],
	snapshotPayload: Record<string, unknown> = {}
) {
	const capturedAt = new Date();
	await prisma.$transaction(async (tx) => {
		await tx.dotaClientSnapshot.create({
			data: {
				userId,
				payload: {
					...snapshotPayload,
					heroProgressPresent: heroes.length > 0,
					officialHeroCount: heroes.length
				}
			}
		});
		for (const hero of heroes) {
			const plus = plusProgressFromXp(hero.xp, hero.level);
			const existing = await tx.dotaHeroProgress.findUnique({
				where: { userId_heroId: { userId, heroId: hero.heroId } }
			});
			if (!shouldReplaceOfficialXp(existing?.xp, hero.xp)) continue;
			await tx.dotaHeroProgress.upsert({
				where: { userId_heroId: { userId, heroId: hero.heroId } },
				create: {
					userId,
					heroId: hero.heroId,
					level: plus.level,
					xp: hero.xp,
					xpToNext: hero.xpToNext ?? plus.xpToNext,
					source: hero.source ?? 'CLIENT',
					capturedAt,
					payload: hero
				},
				update: {
					level: plus.level,
					xp: hero.xp,
					xpToNext: hero.xpToNext ?? plus.xpToNext,
					source: hero.source ?? 'CLIENT',
					capturedAt,
					payload: hero
				}
			});
		}
	});
	return { officialHeroCount: heroes.length, capturedAt: capturedAt.toISOString() };
}
