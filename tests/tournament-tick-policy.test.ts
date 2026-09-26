import { describe, expect, it } from 'vitest';
import { decideClosedCheckIn } from '@/lib/tournament-tick-policy';

const now = new Date('2026-08-23T12:00:00.000Z');
const closed = new Date('2026-08-23T11:00:00.000Z');
const open = new Date('2026-08-23T13:00:00.000Z');

describe('decideClosedCheckIn', () => {
	it('waits while check-in is still open', () => {
		expect(
			decideClosedCheckIn({
				status: 'CHECK_IN',
				checkInClosesAt: open,
				existingMatchCount: 0,
				checkedInCount: 4,
				now
			})
		).toBe('wait');
	});

	it('generates a bracket after the window if two or more teams checked in', () => {
		expect(
			decideClosedCheckIn({
				status: 'CHECK_IN',
				checkInClosesAt: closed,
				existingMatchCount: 0,
				checkedInCount: 2,
				now
			})
		).toBe('generate');
	});

	it('cancels when fewer than two teams checked in', () => {
		expect(
			decideClosedCheckIn({
				status: 'CHECK_IN',
				checkInClosesAt: closed,
				existingMatchCount: 0,
				checkedInCount: 1,
				now
			})
		).toBe('cancel');
	});

	it('does not generate twice if matches already exist', () => {
		expect(
			decideClosedCheckIn({
				status: 'CHECK_IN',
				checkInClosesAt: closed,
				existingMatchCount: 3,
				checkedInCount: 4,
				now
			})
		).toBe('wait');
	});

	it('ignores tournaments that are not in check-in', () => {
		expect(
			decideClosedCheckIn({
				status: 'LIVE',
				checkInClosesAt: closed,
				existingMatchCount: 0,
				checkedInCount: 4,
				now
			})
		).toBe('wait');
	});
});
