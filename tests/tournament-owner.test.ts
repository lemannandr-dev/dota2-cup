import { describe, expect, it } from 'vitest';
import { isCupDryRun } from '@/lib/cup-label';
import { shouldResetOrphanPrize } from '@/lib/tournament-owner';

describe('isCupDryRun', () => {
	it('marks stand prize rehearsals and leaves announced cups alone', () => {
		expect(isCupDryRun('Прогон приза 2026-08-24 17:09')).toBe(true);
		expect(isCupDryRun('  Прогон приза стенда')).toBe(true);
		expect(isCupDryRun('Aegis Weekend Clash')).toBe(false);
		expect(isCupDryRun('Кубок без прогона приза в середине')).toBe(false);
	});
});

describe('shouldResetOrphanPrize', () => {
	it('resets CONFIRMED only when the cup had no owner and no escrow spend', () => {
		expect(shouldResetOrphanPrize({ hadOwner: false, prizeStatus: 'CONFIRMED', hasEscrowTx: false })).toBe(true);
	});

	it('keeps the status when money already left the ledger or an owner already exists', () => {
		expect(shouldResetOrphanPrize({ hadOwner: false, prizeStatus: 'CONFIRMED', hasEscrowTx: true })).toBe(false);
		expect(shouldResetOrphanPrize({ hadOwner: true, prizeStatus: 'CONFIRMED', hasEscrowTx: false })).toBe(false);
		expect(shouldResetOrphanPrize({ hadOwner: false, prizeStatus: 'UNCONFIRMED', hasEscrowTx: false })).toBe(false);
	});
});
