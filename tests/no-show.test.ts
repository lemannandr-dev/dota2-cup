import { describe, expect, it } from 'vitest';
import { noShowSeriesScore } from '@/lib/no-show';

describe('no-show series score', () => {
	it('gives the present side a finished series', () => {
		expect(noShowSeriesScore(1, 'A')).toEqual({ scoreA: 0, scoreB: 1 });
		expect(noShowSeriesScore(3, 'B')).toEqual({ scoreA: 2, scoreB: 0 });
	});
});
