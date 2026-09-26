import { describe, expect, it } from 'vitest';
import {
	buildTeamMatchup,
	eloWinChance,
	estimateMmrFromRankTier,
	playerMatchupStrength,
	type MatchupTeam
} from '@/lib/bracket-matchup';
import { dotaHeroThumb, DOTA_HERO_META } from '@/lib/dota-hero-catalog';

function team(id: string, name: string, members: MatchupTeam['members']): MatchupTeam {
	return { id, name, members };
}

describe('bracket matchup strength', () => {
	it('estimates MMR from OpenDota rank_tier medals', () => {
		expect(estimateMmrFromRankTier(11)).toBe(0);
		expect(estimateMmrFromRankTier(15)).toBe(616);
		expect(estimateMmrFromRankTier(45)).toBe(2310 + 4 * 154);
		expect(estimateMmrFromRankTier(80)).toBe(5420);
		expect(estimateMmrFromRankTier(null)).toBeNull();
	});

	it('prefers stored OpenDota MMR over rank estimate and arena', () => {
		expect(
			playerMatchupStrength({
				id: 'a',
				displayName: 'A',
				avatarUrl: null,
				openDotaMmr: 4200,
				openDotaMmrSource: 'solo',
				rankTier: 45,
				arenaRating: 1000
			})
		).toBe(4200);

		expect(
			playerMatchupStrength({
				id: 'b',
				displayName: 'B',
				avatarUrl: null,
				rankTier: 75,
				arenaRating: 1100
			})
		).toBe(estimateMmrFromRankTier(75));
	});

	it('adds Plus hero depth without inventing Valve MMR', () => {
		const bare = playerMatchupStrength({
			id: 'c',
			displayName: 'C',
			avatarUrl: null,
			openDotaMmr: 3000,
			openDotaMmrSource: 'estimate'
		});
		const withHeroes = playerMatchupStrength({
			id: 'c',
			displayName: 'C',
			avatarUrl: null,
			openDotaMmr: 3000,
			openDotaMmrSource: 'estimate',
			heroes: [
				{ heroId: 1, level: 25 },
				{ heroId: 2, level: 20 },
				{ heroId: 3, level: 10 }
			]
		});
		expect(withHeroes).toBeGreaterThan(bare);
		expect(withHeroes - bare).toBe(3 * 12 + 2 * 18);
	});

	it('uses Elo curve for side win chance', () => {
		expect(eloWinChance(4000, 4000)).toBe(0.5);
		expect(eloWinChance(4400, 4000)).toBeGreaterThan(0.7);
		expect(eloWinChance(3600, 4000)).toBeLessThan(0.3);
	});

	it('builds team vs team forecast with per-player edges', () => {
		const teamA = team('a', 'Radiant Five', [
			{
				id: 'a1',
				displayName: 'Carry',
				avatarUrl: null,
				confirmed: true,
				openDotaMmr: 5000,
				openDotaMmrSource: 'solo',
				heroes: [{ heroId: 8, level: 25, name: 'Juggernaut', image: '/heroes/juggernaut.webp' }]
			},
			{
				id: 'a2',
				displayName: 'Mid',
				avatarUrl: null,
				confirmed: true,
				openDotaMmr: 4800,
				openDotaMmrSource: 'solo'
			},
			{
				id: 'a3',
				displayName: 'Off',
				avatarUrl: null,
				confirmed: true,
				rankTier: 70
			},
			{
				id: 'a4',
				displayName: 'Soft',
				avatarUrl: null,
				confirmed: true,
				rankTier: 65
			},
			{
				id: 'a5',
				displayName: 'Hard',
				avatarUrl: null,
				confirmed: true,
				rankTier: 60
			}
		]);
		const teamB = team('b', 'Dire Five', [
			{
				id: 'b1',
				displayName: 'CarryB',
				avatarUrl: null,
				confirmed: true,
				openDotaMmr: 3200,
				openDotaMmrSource: 'estimate'
			},
			{
				id: 'b2',
				displayName: 'MidB',
				avatarUrl: null,
				confirmed: true,
				rankTier: 45
			},
			{
				id: 'b3',
				displayName: 'OffB',
				avatarUrl: null,
				confirmed: true,
				arenaRating: 1200
			},
			{
				id: 'b4',
				displayName: 'SoftB',
				avatarUrl: null,
				confirmed: true,
				arenaRating: 1100
			},
			{
				id: 'b5',
				displayName: 'HardB',
				avatarUrl: null,
				confirmed: true,
				arenaRating: 1000
			}
		]);

		const matchup = buildTeamMatchup(teamA, teamB);
		expect(matchup.teamAWinPct).toBeGreaterThan(matchup.teamBWinPct);
		expect(matchup.teamAWinPct + matchup.teamBWinPct).toBe(100);
		expect(matchup.sideA).toHaveLength(5);
		expect(matchup.sideB).toHaveLength(5);
		expect(matchup.sideA[0].winChanceVsOpp).toBeGreaterThanOrEqual(matchup.sideA[4].winChanceVsOpp);
		expect(matchup.sideA[0].heroes[0]?.heroId).toBe(8);
		expect(matchup.confidence).toBe('high');
		expect(matchup.hint.length).toBeGreaterThan(10);
		expect(matchup.hint).not.toMatch(/live mmr/i);
	});

	it('keeps confidence low when roster has almost no cache', () => {
		const empty = team('x', 'TBD', [
			{ id: '1', displayName: 'A', avatarUrl: null, confirmed: true },
			{ id: '2', displayName: 'B', avatarUrl: null, confirmed: true }
		]);
		const other = team('y', 'Also TBD', [
			{ id: '3', displayName: 'C', avatarUrl: null, confirmed: true },
			{ id: '4', displayName: 'D', avatarUrl: null, confirmed: true }
		]);
		expect(buildTeamMatchup(empty, other).confidence).toBe('low');
	});
});

describe('dota hero catalog for matchup thumbs', () => {
	it('covers a full hero id map including Kez', () => {
		expect(DOTA_HERO_META.length).toBeGreaterThan(120);
		expect(dotaHeroThumb(8)).toEqual({ name: 'Juggernaut', image: '/heroes/juggernaut.webp' });
		expect(dotaHeroThumb(146)?.name).toBe('Kez');
		expect(dotaHeroThumb(9999)).toBeNull();
	});
});
