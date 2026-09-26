import { describe, expect, it } from 'vitest';
import { nextPowerOfTwo, seedOrder, validateSeriesScore, winnerFromScores } from '../lib/bracket-pure';

describe('bracket seeding', () => {
	it('pads to the next power of two', () => {
		expect(nextPowerOfTwo(5)).toBe(8);
		expect(nextPowerOfTwo(8)).toBe(8);
		expect(nextPowerOfTwo(9)).toBe(16);
	});

	it('uses standard size-8 pairing', () => {
		expect(seedOrder(8)).toEqual([1, 8, 4, 5, 2, 7, 3, 6]);
	});

	it('uses standard size-16 pairing ends', () => {
		const order = seedOrder(16);
		expect(order[0]).toBe(1);
		expect(order[1]).toBe(16);
		expect(order.length).toBe(16);
	});
});

describe('series score', () => {
	it('rejects a draw', () => {
		expect(validateSeriesScore(1, 0, 0)).toBe('Draws are not allowed');
	});

	it('rejects unfinished BO3', () => {
		expect(validateSeriesScore(3, 1, 0)).toContain('Series not finished');
	});

	it('accepts finished BO3', () => {
		expect(validateSeriesScore(3, 2, 1)).toBeNull();
	});

	it('picks the winner from scores', () => {
		expect(winnerFromScores('a', 'b', 2, 1)).toBe('a');
		expect(winnerFromScores('a', 'b', 0, 1)).toBe('b');
	});
});
