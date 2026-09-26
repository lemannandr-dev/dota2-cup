import { describe, expect, it } from 'vitest';
import { buildAdminAttention, isOverdueReport, isStuckBracket } from '@/lib/admin-desk';

describe('admin desk attention', () => {
	it('queues unconfirmed prize, open dispute and review', () => {
		const rows = buildAdminAttention({
			cups: [
				{
					id: 'cup-1',
					title: 'Weekend Clash',
					prizePool: 1_500_000,
					prizeStatus: 'UNCONFIRMED',
					ownerBalance: 0,
					ownerId: 'org'
				}
			],
			disputes: [{ id: 'd1', matchId: 'm1', tournamentId: 'cup-1', tournamentTitle: 'Weekend Clash', pair: 'А — Б' }],
			reviews: [{ id: 'm2', tournamentId: 'cup-1', tournamentTitle: 'Weekend Clash', pair: 'В — Г' }]
		});
		expect(rows).toHaveLength(3);
		expect(rows[0].hint).toMatch(/не хватает/i);
		expect(rows[0].href).toContain('/admin/balance');
		expect(rows[1].title).toMatch(/Спор/);
		expect(rows[1].href).toBe('/tournaments/cup-1#match-m1');
		expect(rows[2].title).toMatch(/Ждёт судью/);
	});

	it('flags overdue report, no check-in, unpaid prize, stuck escrow and bracket', () => {
		const rows = buildAdminAttention({
			cups: [],
			disputes: [],
			reviews: [],
			overdueReports: [{ id: 'm1', tournamentId: 'cup-1', tournamentTitle: 'Clash', pair: 'A — B' }],
			noCheckInCups: [{ id: 'cup-2', title: 'Sunday', pendingCount: 3 }],
			unpaidPrizes: [{ id: 'cup-3', title: 'Final', reservedCount: 2 }],
			stuckEscrows: [{ id: 'cup-4', title: 'Cancelled', prizePool: 500_000 }],
			stuckBrackets: [{ id: 'cup-5', title: 'Late grid', checkedInCount: 4 }]
		});
		expect(rows.map((row) => row.kind)).toEqual([
			'overdue_report',
			'no_checkin',
			'unpaid_prize',
			'stuck_escrow',
			'stuck_bracket'
		]);
	});

	it('detects overdue report and stuck bracket by deadline', () => {
		const now = new Date('2026-08-26T12:00:00.000Z');
		expect(
			isOverdueReport({
				reportDeadlineAt: '2026-08-26T11:00:00.000Z',
				status: 'SCHEDULED',
				now
			})
		).toBe(true);
		expect(
			isOverdueReport({
				reportDeadlineAt: '2026-08-26T11:00:00.000Z',
				status: 'COMPLETED',
				now
			})
		).toBe(false);
		expect(
			isStuckBracket({
				status: 'CHECK_IN',
				checkInClosesAt: '2026-08-26T11:57:00.000Z',
				matchCount: 0,
				checkedInCount: 4,
				now
			})
		).toBe(true);
	});
});
