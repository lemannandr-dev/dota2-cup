import { describe, expect, it } from 'vitest';
import { buildCupTrophy } from '@/lib/cup-trophy';

describe('cup trophy', () => {
	it('builds engraving only when the final has a winner', () => {
		const trophy = buildCupTrophy({
			title: 'Aegis Weekend Clash',
			startAt: '2026-08-25T16:00:00.000Z',
			matches: [
				{
					bracket: 'winners',
					winnerTeamId: 't1',
					teamAId: 't1',
					teamBId: 't2',
					nextMatchId: null,
					teamA: { id: 't1', name: 'Iskry' },
					teamB: { id: 't2', name: 'Dire' }
				}
			],
			applications: [
				{
					teamId: 't1',
					rosterSnapshot: [{ displayName: 'o555aa', steamId: '76561198835548729' }],
					team: { id: 't1', name: 'Iskry', members: [{ user: { displayName: 'o555aa', steamId: '76561198835548729' } }] }
				}
			]
		});
		expect(trophy).toMatchObject({
			year: 2026,
			engraving: 'Iskry',
			title: 'Aegis Weekend Clash',
			winnerTeamId: 't1',
			prizeLabel: 'без фонда',
			prizeKind: 'none',
			runnerUpTeamName: 'Dire'
		});
		expect(trophy?.players[0]?.steamNick).toBe('o555aa');
		expect(buildCupTrophy({ title: 'x', matches: [], applications: [] })).toBeNull();
	});

	it('does not invent a reserved prize when the pool is empty', () => {
		const trophy = buildCupTrophy({
			title: 'Витрина кубка Aegis 2026',
			prizePool: 0,
			prizeStatus: 'NONE',
			startAt: '2026-08-25T16:00:00.000Z',
			matches: [
				{
					bracket: 'winners',
					winnerTeamId: 't1',
					teamAId: 't1',
					teamBId: 't2',
					scoreA: 1,
					scoreB: 0,
					nextMatchId: null,
					teamA: { id: 't1', name: 'Тестовая пятёрка Aegis' },
					teamB: { id: 't2', name: 'Тренировочный стек Света' }
				}
			],
			applications: [
				{
					teamId: 't1',
					rosterSnapshot: [{ displayName: 'o555aa', steamId: '76561198835548729' }],
					team: { id: 't1', name: 'Тестовая пятёрка Aegis' }
				}
			]
		});
		expect(trophy?.prizeLabel).toBe('без фонда');
		expect(trophy?.prizeHint).toBeNull();
		expect(trophy?.finalScore).toBe('1:0');
		expect(trophy?.highlights).toEqual([]);
		expect(trophy?.teams[0]?.href).toBe('/teams?team=t1');
	});
});
