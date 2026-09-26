import { describe, expect, it } from 'vitest';
import { bonusCodeRejectReason, parseWalletAmount, walletMatchesQuery, walletTxMatches } from '@/lib/wallet';

describe('wallet', () => {
	it('rejects non-integer and huge balance edits', () => {
		expect(parseWalletAmount(150000)).toBe(150000);
		expect(parseWalletAmount(12.5)).toBeNull();
		expect(parseWalletAmount(0)).toBeNull();
		expect(parseWalletAmount(50_000_001)).toBeNull();
	});

	it('filters ledger rows without inventing money', () => {
		expect(walletTxMatches({ type: 'BONUS', amount: 5000 }, 'BONUS')).toBe(true);
		expect(walletTxMatches({ type: 'SPENT', amount: -1500000 }, 'ESCROW')).toBe(true);
		expect(walletTxMatches({ type: 'DEPOSIT', amount: 100 }, 'OUT')).toBe(false);
	});

	it('does not redeem an inactive, empty or exhausted promo', () => {
		const now = new Date('2026-09-04T12:00:00.000Z');
		expect(bonusCodeRejectReason({ isActive: false, amount: 1000, usedCount: 0, maxUses: 1, now })).toBe('Код не подходит');
		expect(bonusCodeRejectReason({ isActive: true, amount: -100, usedCount: 0, maxUses: 1, now })).toBe('Код не подходит');
		expect(
			bonusCodeRejectReason({ isActive: true, amount: 1000, usedCount: 1, maxUses: 1, now })
		).toBe('Лимит исчерпан');
		expect(
			bonusCodeRejectReason({
				isActive: true,
				amount: 1000,
				usedCount: 0,
				maxUses: 5,
				minLevel: 3,
				userLevel: 1,
				now
			})
		).toBe('Не хватает уровня');
		expect(
			bonusCodeRejectReason({
				isActive: true,
				amount: 1000,
				usedCount: 0,
				maxUses: 1,
				roles: ['ORGANIZER'],
				now
			})
		).toBe('Код не для этой роли');
	});

	it('searches ledger by description and type label', () => {
		expect(walletMatchesQuery({ type: 'BONUS', description: 'Промо AEGIS-WEEKEND' }, 'weekend')).toBe(true);
		expect(walletMatchesQuery({ type: 'SPENT', description: 'Эскроу призового фонда' }, 'бонус')).toBe(false);
	});
});
