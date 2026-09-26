import { describe, expect, it } from 'vitest';
import { buildMatchRecap, pickLatestClosedMatch, PLUS_RECAP_HINT } from '@/lib/match-recap';

describe('match recap', () => {
	it('gives +16 to the winner and does not invent a Plus badge', () => {
		const recap = buildMatchRecap({
			matchId: 'm1',
			status: 'COMPLETED',
			scoreA: 2,
			scoreB: 1,
			winnerTeamId: 'a',
			teamId: 'a',
			teamName: 'Искры',
			opponentName: 'Кузница',
			nextMatchId: 'final'
		});
		expect(recap).toMatchObject({
			scoreLabel: '2:1',
			won: true,
			ratingDelta: 16,
			ratingLabel: '+16 рейтинг арены'
		});
		expect(recap?.nextHint).toContain('дальше');
		expect(recap?.plusHint).toBe(PLUS_RECAP_HINT);
		expect(recap?.plusHint).not.toMatch(/50 XP|Plus XP/i);
	});

	it('gives -12 to the loser and marks a technical', () => {
		const recap = buildMatchRecap({
			matchId: 'm2',
			status: 'TECHNICAL',
			scoreA: 1,
			scoreB: 0,
			winnerTeamId: 'a',
			teamId: 'b',
			teamName: 'Кузница',
			opponentName: 'Искры'
		});
		expect(recap).toMatchObject({ won: false, ratingDelta: -12, technical: true });
		expect(recap?.nextHint).toContain('Техническое поражение');
	});

	it('embeds ability icons when abilityIds are provided', () => {
		const recap = buildMatchRecap({
			matchId: 'm3',
			status: 'COMPLETED',
			scoreA: 2,
			scoreB: 0,
			winnerTeamId: 'a',
			teamId: 'a',
			teamName: 'A',
			abilityIds: ['axe_berserkers_call', 'axe_culling_blade']
		});
		expect(recap?.abilityIcons).toHaveLength(2);
		expect(recap?.abilityIcons?.[0].src).toContain('axe_berserkers_call');
	});

	it('ignores an open pair and picks the latest closed one', () => {
		expect(
			pickLatestClosedMatch([
				{ status: 'SCHEDULED', winnerTeamId: null, finishedAt: null },
				{ status: 'COMPLETED', winnerTeamId: 'a', finishedAt: '2026-08-24T10:00:00.000Z' },
				{ status: 'COMPLETED', winnerTeamId: 'b', finishedAt: '2026-08-24T12:00:00.000Z' }
			])
		).toMatchObject({ winnerTeamId: 'b' });
		expect(buildMatchRecap({ matchId: 'x', status: 'SCHEDULED', scoreA: 0, scoreB: 0, teamId: 'a', teamName: 'A' })).toBeNull();
	});
});
