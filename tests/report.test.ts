import { describe, expect, it } from 'vitest';
import { decideReportOutcome } from '../server/matches/score';
import { shouldSkipIdempotentPayout } from '@/lib/concurrency-policy';

describe('dual captain reports', () => {
	it('waits when only one captain reported', () => {
		expect(decideReportOutcome({ scoreA: 1, scoreB: 0 }, null)).toEqual({ action: 'wait' });
	});

	it('advances when both captains submit the same score', () => {
		expect(decideReportOutcome({ scoreA: 2, scoreB: 1 }, { scoreA: 2, scoreB: 1 })).toEqual({
			action: 'advance',
			scoreA: 2,
			scoreB: 1
		});
	});

	it('opens a dispute when scores differ', () => {
		expect(decideReportOutcome({ scoreA: 2, scoreB: 0 }, { scoreA: 1, scoreB: 2 })).toEqual({ action: 'dispute' });
	});

	it('second payout attempt is no-op when ledger key already exists', () => {
		expect(shouldSkipIdempotentPayout('RESERVED', true)).toBe(true);
		expect(shouldSkipIdempotentPayout('PAID', false)).toBe(true);
	});

	it('duplicate report upsert converges to same advance decision', () => {
		const first = decideReportOutcome({ scoreA: 2, scoreB: 0 }, null);
		const second = decideReportOutcome({ scoreA: 2, scoreB: 0 }, { scoreA: 2, scoreB: 0 });
		expect(first).toEqual({ action: 'wait' });
		expect(second).toEqual({ action: 'advance', scoreA: 2, scoreB: 0 });
	});
});
