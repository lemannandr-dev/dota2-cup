import { describe, expect, it } from 'vitest';
import { parseAegisAward, suggestAegisAward } from '@/lib/aegis-awards';
import { buildCupTrophy } from '@/lib/cup-trophy';

describe('aegis awards', () => {
	it('falls back to ember and does not invent an id', () => {
		expect(parseAegisAward('void')).toBe('void');
		expect(parseAegisAward('gold')).toBe('ember');
	});

	it('suggests void, night, relic, then ember', () => {
		expect(suggestAegisAward({ inviteOnly: true, format: 'DOUBLE_ELIMINATION' })).toBe('void');
		expect(suggestAegisAward({ startAt: '2026-09-04T19:30:00.000Z' })).toBe('night');
		expect(suggestAegisAward({ format: 'DOUBLE_ELIMINATION', startAt: '2026-09-04T12:00:00.000Z' })).toBe('relic');
		expect(suggestAegisAward({ seriesRules: 'BO3', startAt: '2026-09-04T12:00:00.000Z' })).toBe('relic');
		expect(suggestAegisAward({ format: 'SINGLE_ELIMINATION', seriesRules: 'BO1', startAt: '2026-09-04T12:00:00.000Z' })).toBe(
			'ember'
		);
	});

	it('puts the cup award on the trophy only after a final', () => {
		const trophy = buildCupTrophy({
			title: 'Night Clash',
			aegisAward: 'night',
			startAt: '2026-09-04T19:00:00.000Z',
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
			applications: [{ teamId: 't1', team: { id: 't1', name: 'Iskry' } }]
		});
		expect(trophy?.award.id).toBe('night');
		expect(trophy?.award.name).toBe('Ночная эгида');
		expect(buildCupTrophy({ title: 'x', aegisAward: 'void', matches: [], applications: [] })).toBeNull();
	});
});
