import { describe, expect, it } from 'vitest';
import { championshipFromTrophy, championshipsForPlayer, championshipsForTeam } from '@/lib/champions';
import { cupCardTitle, cupPublicHref, isCupShowcase } from '@/lib/cup-label';
import { buildCupTrophy } from '@/lib/cup-trophy';

describe('champions index', () => {
	it('marks showcase cups and indexes team plus roster', () => {
		expect(isCupShowcase('Витрина кубка Aegis 2026')).toBe(true);
		expect(cupCardTitle('Прогон приза 2026-08-24 17:09')).toBe('Прогон приза');
		expect(cupPublicHref('cup-1')).toBe('/tournaments/cup-1/cup');
		const trophy = buildCupTrophy({
			tournamentId: 'cup-1',
			title: 'Витрина кубка Aegis 2026',
			startAt: '2026-08-25T12:00:00.000Z',
			matches: [
				{
					bracket: 'winners',
					winnerTeamId: 'team-a',
					teamAId: 'team-a',
					teamBId: 'team-b',
					nextMatchId: null,
					teamA: { id: 'team-a', name: 'Тестовая пятёрка Aegis' },
					teamB: { id: 'team-b', name: 'Тренировочный стек Света' }
				}
			],
			applications: [
				{
					teamId: 'team-a',
					rosterSnapshot: [
						{ userId: 'u1', displayName: 'o555aa', steamId: '76561198835548729' },
						{ userId: 'u2', displayName: 'Radiant Captain', steamId: '76561198000000001' }
					],
					team: {
						id: 'team-a',
						name: 'Тестовая пятёрка Aegis',
						members: [{ userId: 'u1', user: { id: 'u1', displayName: 'o555aa', steamId: '76561198835548729' } }]
					}
				}
			]
		});
		const row = championshipFromTrophy(trophy!);
		expect(row).toMatchObject({
			winnerTeamId: 'team-a',
			showcase: true,
			href: '/tournaments/cup-1/cup'
		});
		expect(championshipsForTeam([row!], 'team-a')).toHaveLength(1);
		expect(championshipsForPlayer([row!], { userId: 'u2' })).toHaveLength(1);
		expect(championshipsForPlayer([row!], { steamId: '76561198835548729' })).toHaveLength(1);
		expect(championshipsForPlayer([row!], { userId: 'other' })).toHaveLength(0);
	});
});
