import { describe, expect, it } from 'vitest';
import { pairSoonDue, pairSoonNotifyRows } from '@/lib/pair-soon';

describe('pair soon', () => {
	it('fires when the pair is scheduled and has a deadline', () => {
		expect(
			pairSoonDue({
				status: 'SCHEDULED',
				teamAId: 'a',
				teamBId: 'b',
				reportDeadlineAt: '2026-08-25T20:00:00.000Z'
			})
		).toBe(true);
		expect(pairSoonDue({ status: 'PENDING', teamAId: 'a', teamBId: null })).toBe(false);
		expect(pairSoonNotifyRows({ tournamentId: 't1', matchId: 'm1', title: 'Cup', userIds: ['u1'] })[0].linkUrl).toBe(
			'/tournaments/t1#match-m1'
		);
	});
});
