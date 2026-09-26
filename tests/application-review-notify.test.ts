import { describe, expect, it } from 'vitest';
import { applicationReviewNotifyRows } from '@/lib/application-review-notify';

describe('application review notify', () => {
	it('writes unique roster rows and keeps the org note', () => {
		const rows = applicationReviewNotifyRows({
			tournamentId: 't1',
			title: 'Weekend Clash',
			status: 'NEEDS_ACTION',
			userIds: ['cap', 'p1', 'cap'],
			note: 'Нет пятого Steam'
		});
		expect(rows).toHaveLength(2);
		expect(rows[0]).toMatchObject({
			type: 'APPLICATION_REVIEW',
			linkUrl: '/tournaments/t1'
		});
		expect(rows[0].title).toContain('Поправьте состав');
		expect(rows[0].body).toContain('Нет пятого Steam');
	});
});
