import { describe, expect, it } from 'vitest';
import {
	applicationDeskCounts,
	applicationRemindNotifyRows,
	collectRemindUserIds,
	filterApplicationDesk,
	recipientsForRemind
} from '@/lib/application-desk';
import { notifyGroupOf } from '@/lib/notify-groups';

const rows = [
	{ id: '1', status: 'SUBMITTED', readyStatus: 'PENDING', team: { name: 'Radiant Five' }, captainId: 'c1', memberIds: ['c1', 'm1'] },
	{ id: '2', status: 'NEEDS_ACTION', readyStatus: 'PENDING', team: { name: 'Dire Core' }, captainId: 'c2', memberIds: ['c2'] },
	{ id: '3', status: 'APPROVED', readyStatus: 'PENDING', team: { name: 'Aegis' }, captainId: 'c3', memberIds: ['c3', 'm3'] },
	{ id: '4', status: 'WAITLIST', readyStatus: 'PENDING', team: { name: 'Bench' }, captainId: 'c4', memberIds: ['c4'] }
];

describe('application desk filters and reminds', () => {
	it('filters by lane, needs_action, waitlist and query', () => {
		const base = { startAt: '2026-09-20T12:00:00.000Z', tournamentStatus: 'REGISTRATION' };
		expect(filterApplicationDesk(rows, { ...base, filter: 'needs_action' }).map((row) => row.id)).toEqual(['2']);
		expect(filterApplicationDesk(rows, { ...base, filter: 'waitlist' })).toHaveLength(1);
		expect(filterApplicationDesk(rows, { ...base, filter: 'all', query: 'radiant' })[0]?.id).toBe('1');
		expect(applicationDeskCounts(rows, base).needs_action).toBe(1);
	});

	it('picks recipients for bulk remind kinds', () => {
		expect(recipientsForRemind(rows, 'needs_action', { tournamentStatus: 'REGISTRATION' }).map((row) => row.id)).toEqual(['2']);
		expect(
			recipientsForRemind(rows, 'check_in', { tournamentStatus: 'CHECK_IN' }).map((row) => row.id)
		).toEqual(['1', '2', '3']);
		expect(
			recipientsForRemind(rows, 'ready', {
				tournamentStatus: 'LIVE',
				startAt: '2026-09-19T10:00:00.000Z',
				now: new Date('2026-09-19T18:00:00.000Z')
			}).map((row) => row.id)
		).toEqual(['3']);
	});

	it('builds unique notify rows and groups them under check_in', () => {
		const notify = applicationRemindNotifyRows({
			kind: 'check_in',
			tournamentId: 't1',
			title: 'Weekend',
			userIds: collectRemindUserIds(rows.slice(0, 1))
		});
		expect(notify).toHaveLength(2);
		expect(notifyGroupOf(notify[0]!.type)).toBe('check_in');
	});
});
