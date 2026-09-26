import { describe, expect, it } from 'vitest';
import {
	dueReferralMilestones,
	isReferralCode,
	nextReferralMilestone,
	referralCodeFromBytes,
	referralShareUrl
} from '@/lib/referrals';

const step = {
	id: 'seed_referral_100',
	threshold: 100,
	amountKopecks: 10000,
	label: '100 приглашённых',
	isActive: true
};

describe('referral rules', () => {
	it('accepts only a short share code', () => {
		expect(isReferralCode('ab23def9')).toBe(true);
		expect(isReferralCode('AB23DEF9')).toBe(false);
		expect(isReferralCode('short')).toBe(false);
		expect(referralCodeFromBytes(new Uint8Array([0, 1, 2, 3, 4, 5, 6, 7]))).toHaveLength(8);
	});

	it('pays the 100-invite step once and shows the next gap before that', () => {
		expect(dueReferralMilestones(99, [step], new Set()).map((row) => row.id)).toEqual([]);
		expect(dueReferralMilestones(100, [step], new Set()).map((row) => row.id)).toEqual(['seed_referral_100']);
		expect(dueReferralMilestones(100, [step], new Set(['seed_referral_100']))).toEqual([]);
		expect(dueReferralMilestones(100, [{ ...step, isActive: false }], new Set())).toEqual([]);
		expect(nextReferralMilestone(12, [step])?.threshold).toBe(100);
		expect(nextReferralMilestone(100, [step])).toBe(null);
		expect(referralShareUrl('http://localhost:3002/', 'ab23def9')).toBe('http://localhost:3002/?ref=ab23def9');
	});
});
