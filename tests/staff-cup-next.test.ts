import { describe, expect, it } from 'vitest';
import { nextStaffCupAction } from '@/lib/staff-cup-next';

describe('nextStaffCupAction', () => {
	it('prioritizes pending applications', () => {
		const next = nextStaffCupAction({
			tournamentId: 't1',
			applications: [{ status: 'SUBMITTED' }, { status: 'APPROVED' }],
			matches: []
		});
		expect(next.code).toBe('applications');
		expect(next.href).toBe('#applications');
		expect(next.label).toContain('1');
	});

	it('then open disputes', () => {
		const next = nextStaffCupAction({
			tournamentId: 't1',
			applications: [{ status: 'APPROVED' }],
			matches: [
				{ id: 'm1', status: 'NEEDS_REVIEW', disputes: [{ status: 'OPEN' }] },
				{ id: 'm2', status: 'PENDING', disputes: [] }
			]
		});
		expect(next.code).toBe('disputes');
		expect(next.href).toBe('#match-m1');
	});

	it('then overdue reports', () => {
		const next = nextStaffCupAction({
			tournamentId: 't1',
			applications: [],
			matches: [
				{
					id: 'm9',
					status: 'PENDING',
					reportDeadlineAt: new Date(Date.now() - 60_000).toISOString(),
					disputes: []
				}
			],
			now: new Date()
		});
		expect(next.code).toBe('matches');
		expect(next.href).toBe('#match-m9');
	});

	it('falls back to matches anchor', () => {
		expect(
			nextStaffCupAction({
				tournamentId: 't1',
				applications: [],
				matches: [{ id: 'm1', status: 'COMPLETED', disputes: [] }]
			}).code
		).toBe('none');
	});
});
