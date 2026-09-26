import { describe, expect, it } from 'vitest';
import {
	formatOpenDotaMmr,
	mmrFromOpenDotaPlayer,
	pickOpenDotaMmr,
	pickOpenDotaRank,
	pickStoredOpenDotaMmr,
	medalCaption,
	rankMedalFromTier,
	storedOpenDotaMmr
} from '@/lib/dota-rank';

describe('rank medal from OpenDota tier', () => {
	it('maps archon 5 and ignores empty tier', () => {
		expect(rankMedalFromTier(45)).toEqual({ tier: 'archon', stars: 5 });
		expect(rankMedalFromTier(80, 12)).toEqual({ tier: 'immortal', leaderboard: 12 });
		expect(rankMedalFromTier(null)).toBeNull();
	});

	it('writes the same caption as the header medal', () => {
		expect(medalCaption({ tier: 'legend', stars: 5 })).toBe('Легенда V');
		expect(medalCaption({ tier: 'immortal', leaderboard: 12 })).toBe('Титан · #12');
	});

	it('keeps the last OpenDota rank when the live call is empty', () => {
		expect(pickOpenDotaRank({ rankTier: 45, leaderboardRank: null }, { rankTier: 30, leaderboardRank: null })).toEqual({
			rankTier: 45,
			leaderboardRank: null
		});
		expect(pickOpenDotaRank({ rankTier: null, leaderboardRank: null }, { rankTier: 45, leaderboardRank: null })).toEqual({
			rankTier: 45,
			leaderboardRank: null
		});
		expect(pickOpenDotaRank(null, null)).toBeNull();
	});
});

describe('OpenDota MMR is a real number, never invented', () => {
	it('prefers Valve solo, then party, then OpenDota computed/estimate', () => {
		expect(
			pickOpenDotaMmr({
				soloCompetitiveRank: 4521,
				competitiveRank: 4100,
				computedMmr: 4029.92,
				mmrEstimate: 3800
			})
		).toEqual({ value: 4521, source: 'solo' });
		expect(pickOpenDotaMmr({ competitiveRank: 4100, computedMmr: 4029.92 })).toEqual({ value: 4100, source: 'party' });
		expect(pickOpenDotaMmr({ computedMmr: 4029.92 })).toEqual({ value: 4030, source: 'estimate' });
		expect(pickOpenDotaMmr({ mmrEstimate: 3800 })).toEqual({ value: 3800, source: 'estimate' });
	});

	it('does not invent MMR from empty, zero, or junk payloads', () => {
		expect(pickOpenDotaMmr({})).toBeNull();
		expect(pickOpenDotaMmr({ computedMmr: 0, mmrEstimate: -12 })).toBeNull();
		expect(mmrFromOpenDotaPlayer(null)).toBeNull();
		expect(mmrFromOpenDotaPlayer({ rank_tier: 45 })).toBeNull();
		expect(storedOpenDotaMmr(1000, 'estimate')).toEqual({ value: 1000, source: 'estimate' });
		expect(storedOpenDotaMmr(null, 'estimate')).toBeNull();
		expect(pickStoredOpenDotaMmr(null, { value: 4030, source: 'estimate' })).toEqual({ value: 4030, source: 'estimate' });
	});

	it('reads computed_mmr from a live OpenDota player payload', () => {
		expect(mmrFromOpenDotaPlayer({ rank_tier: 45, computed_mmr: 4029.92, mmr_estimate: { estimate: 3800 } })).toEqual({
			value: 4030,
			source: 'estimate'
		});
		expect(formatOpenDotaMmr({ value: 4030, source: 'estimate' })).toBe('оценка OpenDota 4030');
		expect(formatOpenDotaMmr({ value: 4521, source: 'solo' })).toBe('MMR 4521');
	});
});
