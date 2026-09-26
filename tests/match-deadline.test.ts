import { describe, expect, it } from 'vitest';
import { computeReportDeadline, decideExpiredReport } from '@/lib/match-deadline';

const now = new Date('2026-08-23T16:00:00.000Z');

describe('computeReportDeadline', () => {
	it('starts the window after the later of assignment and tournament start', () => {
		expect(
			computeReportDeadline(
				new Date('2026-08-23T10:00:00.000Z'),
				new Date('2026-08-23T13:00:00.000Z'),
				3 * 60 * 60 * 1000
			).toISOString()
		).toBe('2026-08-23T16:00:00.000Z');
	});
});

describe('decideExpiredReport', () => {
	const pair = {
		deadline: '2026-08-23T15:00:00.000Z',
		status: 'SCHEDULED',
		teamAId: 'a',
		teamBId: 'b',
		now
	};

	it('waits before the deadline or when nobody / both reported', () => {
		expect(decideExpiredReport({ ...pair, deadline: '2026-08-23T17:00:00.000Z', reports: [] }).action).toBe(
			'wait'
		);
		expect(decideExpiredReport({ ...pair, reports: [] }).action).toBe('wait');
		expect(
			decideExpiredReport({
				...pair,
				reports: [
					{ teamId: 'a', scoreA: 1, scoreB: 0 },
					{ teamId: 'b', scoreA: 0, scoreB: 1 }
				]
			}).action
		).toBe('wait');
		expect(decideExpiredReport({ ...pair, status: 'NEEDS_REVIEW', reports: [{ teamId: 'a', scoreA: 1, scoreB: 0 }] }).action).toBe(
			'wait'
		);
	});

	it('takes the lone report as a technical result after the deadline', () => {
		expect(
			decideExpiredReport({
				...pair,
				reports: [{ teamId: 'a', scoreA: 2, scoreB: 0 }]
			})
		).toEqual({ action: 'accept_report', scoreA: 2, scoreB: 0 });
	});
});
