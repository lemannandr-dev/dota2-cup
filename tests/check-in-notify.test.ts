import { describe, expect, it } from 'vitest';
import { checkInNotifyRows } from '@/lib/check-in-notify';

describe('checkInNotifyRows', () => {
	it('notifies unique captains and roster members', () => {
		const rows = checkInNotifyRows({
			tournamentId: 't1',
			title: 'Aegis Cup',
			userIds: ['cap', 'p1', 'cap']
		});
		expect(rows).toHaveLength(2);
		expect(rows[0]).toMatchObject({
			userId: 'cap',
			type: 'TOURNAMENT_CHECK_IN',
			linkUrl: '/tournaments/t1'
		});
	});
});
