import { prisma } from '@/lib/prisma';
import { plusProgressFromXp } from '@/lib/dota-plus-hero';
import type { HeroProgress } from '@/lib/dota-stats';

export type HeroProgressSource = 'official' | 'estimate';

export type OfficialHeroRow = {
	heroId: number;
	xp: number;
	level: number;
	xpToNext?: number | null;
	capturedAt: Date | string;
};

export function mergeOfficialHeroRows(
	official: OfficialHeroRow[],
	estimated: HeroProgress[]
): { source: HeroProgressSource; capturedAt: string | null; heroes: HeroProgress[] } {
	if (official.length === 0) {
		return { source: 'estimate', capturedAt: null, heroes: estimated };
	}

	const officialById = new Map(official.map((row) => [row.heroId, row]));
	const estimatedById = new Map(estimated.map((hero) => [hero.heroId, hero]));
	const heroIds = new Set<number>([...officialById.keys(), ...estimatedById.keys()]);
	const heroes = Array.from(heroIds).map((heroId) => {
		const row = officialById.get(heroId);
		const fallback = estimatedById.get(heroId);
		const plus = row ? plusProgressFromXp(row.xp, row.level) : null;
		return {
			heroId,
			heroName: fallback?.heroName ?? `Hero #${heroId}`,
			heroImage: fallback?.heroImage ?? '',
			games: fallback?.games ?? 0,
			win: fallback?.win ?? 0,
			winRate: fallback?.winRate ?? 0,
			lastPlayed: fallback?.lastPlayed ?? 0,
			level: plus?.level ?? fallback?.level ?? 0,
			levelLabel: plus?.levelLabel ?? fallback?.levelLabel ?? 'Нет прогресса',
			tier: plus?.tier ?? fallback?.tier ?? 'bronze',
			xp: plus?.xp ?? fallback?.xp ?? 0,
			levelStartXp: plus?.levelStartXp ?? fallback?.levelStartXp ?? 0,
			nextLevelXp: plus?.nextLevelXp ?? fallback?.nextLevelXp ?? null,
			xpToNext: row?.xpToNext ?? plus?.xpToNext ?? fallback?.xpToNext ?? null,
			progressPct: plus?.progressPct ?? fallback?.progressPct ?? 0,
			history: fallback?.history ?? [],
			official: Boolean(row)
		} satisfies HeroProgress;
	});

	const newest = official[0]?.capturedAt;
	return {
		source: 'official',
		capturedAt: newest instanceof Date ? newest.toISOString() : newest ?? null,
		heroes
	};
}

export async function mergeOfficialHeroProgress(
	userId: string | null,
	estimated: HeroProgress[]
): Promise<{ source: HeroProgressSource; capturedAt: string | null; heroes: HeroProgress[] }> {
	if (!userId) {
		return { source: 'estimate', capturedAt: null, heroes: estimated };
	}

	const official = await prisma.dotaHeroProgress.findMany({
		where: { userId },
		orderBy: { capturedAt: 'desc' }
	});
	return mergeOfficialHeroRows(official, estimated);
}
