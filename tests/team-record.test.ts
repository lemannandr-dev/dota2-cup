import { describe, expect, it } from 'vitest';
import { buildTeamRecord } from '@/lib/team-record';

const aegis = 'team-aegis';
const stack = 'team-stack';

describe('buildTeamRecord', () => {
	it('marks a closed final as a championship and counts the series', () => {
		const record = buildTeamRecord(
			aegis,
			[{ tournamentId: 'cup-1', title: 'Витрина', status: 'FINISHED', applicationStatus: 'IN_BRACKET' }],
			[{
				tournamentId: 'cup-1',
				teamAId: aegis,
				teamBId: stack,
				scoreA: 1,
				scoreB: 0,
				status: 'COMPLETED',
				winnerTeamId: aegis,
				nextMatchId: null
			}]
		);
		expect(record.wins).toBe(1);
		expect(record.losses).toBe(0);
		expect(record.winRate).toBe(100);
		expect(record.cups[0]?.result).toBe('чемпион · 1:0');
		expect(record.cups[0]?.statusLabel).toBe('Завершён');
		expect(record.cups[0]?.href).toBe('/tournaments/cup-1');
	});

	it('records an elimination from the losing side and leaves a scheduled cup in the bracket', () => {
		const record = buildTeamRecord(
			stack,
			[
				{ tournamentId: 'cup-1', title: 'Витрина', status: 'FINISHED', applicationStatus: 'IN_BRACKET' },
				{ tournamentId: 'cup-2', title: 'Weekend', status: 'LIVE', applicationStatus: 'IN_BRACKET' }
			],
			[
				{
					tournamentId: 'cup-1',
					teamAId: aegis,
					teamBId: stack,
					scoreA: 2,
					scoreB: 1,
					status: 'COMPLETED',
					winnerTeamId: aegis,
					nextMatchId: null
				},
				{
					tournamentId: 'cup-2',
					teamAId: stack,
					teamBId: 'other',
					scoreA: 0,
					scoreB: 0,
					status: 'SCHEDULED',
					winnerTeamId: null,
					nextMatchId: 'later'
				}
			]
		);
		expect(record.wins).toBe(0);
		expect(record.losses).toBe(1);
		expect(record.winRate).toBe(0);
		expect(record.cups.map((cup) => cup.result)).toEqual(['вылет · 1:2', 'в сетке']);
	});

	it('keeps a live-cup win as a series win until the tournament is finished', () => {
		const record = buildTeamRecord(
			aegis,
			[{ tournamentId: 'cup-2', title: 'Weekend', status: 'LIVE', applicationStatus: 'IN_BRACKET' }],
			[{
				tournamentId: 'cup-2',
				teamAId: aegis,
				teamBId: stack,
				scoreA: 2,
				scoreB: 1,
				status: 'COMPLETED',
				winnerTeamId: aegis,
				nextMatchId: null
			}]
		);
		expect(record.cups[0]?.result).toBe('победа · 2:1');
	});

	it('does not invent a record when the team has no cups', () => {
		expect(buildTeamRecord('solo', [], [])).toEqual({ wins: 0, losses: 0, winRate: null, cups: [] });
	});
});
