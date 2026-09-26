import { describe, expect, it } from 'vitest';
import {
	adminReferralCounts,
	adminReferralPasses,
	adminReferralProgress,
	sortAdminReferrals,
	type AdminReferralUser
} from '@/lib/admin-referrals';

const rows: AdminReferralUser[] = [
	{
		id: 'owner',
		displayName: 'o555aa',
		referralCode: 'ab23def9',
		accepted: [
			{ id: 'a', displayName: 'Hotel-hard', createdAt: '2026-09-01T00:00:00.000Z' },
			{ id: 'b', displayName: 'Hotel-soft', createdAt: '2026-09-02T00:00:00.000Z' }
		],
		paidLabels: ['100 приглашённых']
	},
	{
		id: 'guest',
		displayName: 'Hotel-hard',
		referralCode: null,
		invitedBy: { id: 'owner', displayName: 'o555aa' },
		accepted: [],
		paidLabels: []
	},
	{
		id: 'solo',
		displayName: 'Капитан',
		referralCode: 'zz99zz99',
		accepted: [],
		paidLabels: []
	}
];

describe('admin referrals roster', () => {
	it('finds an inviter by the nick that accepted', () => {
		expect(rows.filter((row) => adminReferralPasses(row, 'all', 'Hotel-soft')).map((row) => row.id)).toEqual(['owner']);
		expect(rows.filter((row) => adminReferralPasses(row, 'joined', '')).map((row) => row.id)).toEqual(['guest']);
		expect(rows.filter((row) => adminReferralPasses(row, 'nocode', '')).map((row) => row.id)).toEqual(['guest']);
	});

	it('counts invites and puts inviters first', () => {
		expect(adminReferralCounts(rows)).toMatchObject({ all: 3, invited: 1, joined: 1, nocode: 1, paid: 1, invites: 2 });
		const sorted = sortAdminReferrals(rows).map((row) => row.id);
		expect(sorted[0]).toBe('owner');
		expect(sorted.slice(1).sort()).toEqual(['guest', 'solo']);
	});

	it('measures the gap to the next step', () => {
		const steps = [
			{ threshold: 1, isActive: true, label: 'первый' },
			{ threshold: 100, isActive: true, label: 'сотня' }
		];
		expect(adminReferralProgress(2, steps)).toMatchObject({ remaining: 98, reached: 1, ratio: 0.02 });
		expect(adminReferralProgress(100, steps).next).toBeNull();
		expect(adminReferralProgress(0, []).ratio).toBe(0);
	});
});