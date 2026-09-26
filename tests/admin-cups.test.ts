import { describe, expect, it } from 'vitest';
import { adminCupFill, adminCupGaps, readableCupCopy, type AdminCupInput } from '@/lib/admin-cups';
import { formatPrizeAmount } from '@/lib/prize-places';

function cup(patch: Partial<AdminCupInput> = {}): AdminCupInput {
	return {
		description: 'Вечерний кубок',
		rules: 'BO1, без паузы',
		region: 'CIS',
		status: 'LIVE',
		maxTeams: 8,
		prizePool: 1_500_000,
		prizeCurrency: 'RUB',
		prizeStatus: 'CONFIRMED',
		checkInOpensAt: '2026-09-22T10:00:00.000Z',
		checkInClosesAt: '2026-09-22T12:00:00.000Z',
		createdById: 'owner',
		ownerTotp: true,
		ownerBalance: 0,
		matches: 4,
		applicationStatuses: ['IN_BRACKET', 'IN_BRACKET', 'CHECKED_IN', 'APPROVED'],
		...patch
	};
}

describe('admin cup gaps', () => {
	it('stays quiet when the card, fund and bracket are in place', () => {
		expect(adminCupGaps(cup())).toEqual([]);
	});

	it('names the missing copy, region and escrow shortfall', () => {
		const gaps = adminCupGaps(
			cup({
				description: '  ',
				rules: null,
				region: null,
				prizeStatus: 'UNCONFIRMED',
				ownerBalance: 0,
				ownerTotp: false
			})
		);
		expect(gaps.map((gap) => gap.id)).toEqual(['description', 'rules', 'region', 'escrow', 'totp']);
		expect(gaps.find((gap) => gap.id === 'escrow')?.label).toBe(`Не хватает ${formatPrizeAmount(1_500_000)}`);
		expect(gaps.find((gap) => gap.id === 'escrow')?.tone).toBe('alert');
	});

	it('says the wallet can cover the fund when escrow is still unconfirmed', () => {
		const gaps = adminCupGaps(cup({ prizeStatus: 'UNCONFIRMED', ownerBalance: 2_000_000 }));
		expect(gaps.map((gap) => gap.label)).toEqual(['Эскроу не списан']);
	});

	it('counts open slots and teams that have not checked in', () => {
		const fill = adminCupFill(['APPROVED', 'APPROVED', 'CHECKED_IN', 'SUBMITTED', 'REJECTED'], 8);
		expect(fill).toMatchObject({ seated: 3, pending: 1, waitingCheckIn: 2, ratio: 3 / 8 });
		const gaps = adminCupGaps(
			cup({
				status: 'CHECK_IN',
				matches: 0,
				applicationStatuses: ['APPROVED', 'CHECKED_IN'],
				maxTeams: 8
			})
		);
		expect(gaps.map((gap) => gap.id)).toEqual(['slots', 'checkin', 'bracket']);
	});

	it('treats a broken rules string as missing', () => {
		expect(readableCupCopy('??????????? Captain Mode, ?????? EU East')).toBeNull();
		expect(readableCupCopy('Демо-турнир для проверки сетки.')).toBe('Демо-турнир для проверки сетки.');
		const gaps = adminCupGaps(cup({ rules: '??????????? Captain Mode, ?????? EU East' }));
		expect(gaps.map((gap) => gap.id)).toEqual(['rules']);
	});

	it('does not ask a finished cup for empty slots', () => {
		expect(adminCupGaps(cup({ status: 'FINISHED', applicationStatuses: ['IN_BRACKET'], maxTeams: 8 }))).toEqual([]);
	});
});
