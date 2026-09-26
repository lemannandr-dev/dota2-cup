import { describe, expect, it } from 'vitest';
import { groupMatchRounds, matchRoundKey, winsToTakeSeries } from '@/lib/match-rounds';

describe('mobile match rounds', () => {
	it('groups matches and keeps upper, lower and grand final in play order', () => {
		const groups = groupMatchRounds([
			{ id: 'l1', bracket: 'losers', round: 1 },
			{ id: 'w2', bracket: 'winners', round: 2 },
			{ id: 'g1', bracket: 'grand', round: 1 },
			{ id: 'w1b', bracket: 'winners', round: 1 },
			{ id: 'w1a', bracket: 'winners', round: 1 }
		]);
		expect(groups.map((group) => group.key)).toEqual(['winners:1', 'winners:2', 'losers:1', 'grand:1']);
		expect(groups[0]?.matches.map((match) => match.id)).toEqual(['w1b', 'w1a']);
		expect(matchRoundKey({ bracket: 'grand', round: 1 })).toBe('grand:1');
		expect(winsToTakeSeries(1)).toBe(1);
		expect(winsToTakeSeries(3)).toBe(2);
		expect(winsToTakeSeries(5)).toBe(3);
	});
});
