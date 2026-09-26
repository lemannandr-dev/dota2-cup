import { describe, expect, it } from 'vitest';
import { previewFirstRoundPairs } from '@/lib/bracket-preview';

describe('bracket preview', () => {
	it('pairs seed 1 vs last and marks bye', () => {
		const pairs = previewFirstRoundPairs([
			{ teamId: 'a', name: 'Alpha', seed: 1 },
			{ teamId: 'b', name: 'Bravo', seed: 2 },
			{ teamId: 'c', name: 'Charlie', seed: 3 }
		]);
		expect(pairs).toHaveLength(2);
		expect(pairs[0].teamA?.name).toBe('Alpha');
		expect(pairs.some((pair) => pair.bye)).toBe(true);
	});
});
