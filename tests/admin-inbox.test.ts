import { describe, expect, it } from 'vitest';
import { adminInboxCounts, adminInboxFilterFor, adminInboxKindLabel, filterAdminInbox } from '@/lib/admin-inbox';
import type { AdminAttention } from '@/lib/admin-desk';

const sample: AdminAttention[] = [
	{ id: '1', kind: 'dispute', title: 'Спор', hint: 'A', href: '/a' },
	{ id: '2', kind: 'overdue_report', title: 'Просрочка', hint: 'B', href: '/b' },
	{ id: '3', kind: 'escrow', title: 'Эскроу', hint: 'C', href: '/c' },
	{ id: '4', kind: 'stuck_bracket', title: 'Сетка', hint: 'D', href: '/d' }
];

describe('admin inbox filters', () => {
	it('groups kinds into matchday / money / roster', () => {
		expect(adminInboxFilterFor('dispute')).toBe('matchday');
		expect(adminInboxFilterFor('unpaid_prize')).toBe('money');
		expect(adminInboxFilterFor('no_checkin')).toBe('roster');
	});

	it('filters and counts inbox rows', () => {
		expect(filterAdminInbox(sample, 'matchday').map((row) => row.kind)).toEqual(['dispute', 'overdue_report']);
		expect(filterAdminInbox(sample, 'money')).toHaveLength(1);
		expect(adminInboxCounts(sample)).toEqual({ all: 4, matchday: 2, money: 1, roster: 1 });
	});

	it('labels kinds for the desk', () => {
		expect(adminInboxKindLabel('review')).toBe('Судья');
		expect(adminInboxKindLabel('stuck_escrow')).toBe('Возврат');
	});
});
