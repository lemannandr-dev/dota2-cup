import { describe, expect, it } from 'vitest';
import { noCheckInNotifyRows } from '@/lib/no-check-in-notify';

describe('no-check-in notify', () => {
	it('tells the whole stack they are out', () => {
		const rows = noCheckInNotifyRows({
			tournamentId: 't1',
			title: 'Weekend Clash',
			userIds: ['cap', 'p2'],
			closesLabel: '25.08, 19:00'
		});
		expect(rows).toHaveLength(2);
		expect(rows[0]).toMatchObject({
			type: 'TOURNAMENT_NO_CHECK_IN',
			linkUrl: '/home'
		});
		expect(rows[0].body).toContain('до 25.08, 19:00');
	});
});
