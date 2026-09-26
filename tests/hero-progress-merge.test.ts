import { describe, expect, it } from 'vitest';
import { mergeOfficialHeroRows } from '@/lib/hero-progress-display';
import { shouldReplaceOfficialXp } from '@/lib/save-official-hero-progress';
import type { HeroProgress } from '@/lib/dota-stats';

const estimate = (heroId: number, extras: Partial<HeroProgress> = {}): HeroProgress => ({
	heroId,
	heroName: `Hero ${heroId}`,
	heroImage: '',
	games: 10,
	win: 4,
	winRate: 40,
	lastPlayed: 0,
	level: 2,
	levelLabel: 'оценка',
	tier: 'bronze',
	xp: 100,
	levelStartXp: 50,
	nextLevelXp: 350,
	xpToNext: 250,
	progressPct: 20,
	history: [],
	...extras
});

describe('merge official hero progress', () => {
	it('keeps estimates when there is no official row', () => {
		const merged = mergeOfficialHeroRows([], [estimate(1)]);
		expect(merged.source).toBe('estimate');
		expect(merged.heroes[0]?.official).toBeFalsy();
		expect(merged.heroes[0]?.xp).toBe(100);
	});

	it('prefers official XP and does not invent a badge from games', () => {
		const merged = mergeOfficialHeroRows(
			[{ heroId: 22, xp: 750, level: 3, capturedAt: '2026-08-24T12:00:00.000Z' }],
			[estimate(22, { heroName: 'Zeus', games: 80 })]
		);
		expect(merged.source).toBe('official');
		expect(merged.heroes[0]).toMatchObject({
			heroId: 22,
			heroName: 'Zeus',
			official: true,
			xp: 750,
			level: 3
		});
	});
});

describe('shouldReplaceOfficialXp', () => {
	it('writes the first snapshot and refuses a lower XP later', () => {
		expect(shouldReplaceOfficialXp(undefined, 100)).toBe(true);
		expect(shouldReplaceOfficialXp(750, 750)).toBe(true);
		expect(shouldReplaceOfficialXp(750, 100)).toBe(false);
	});
});
