import { describe, expect, it } from 'vitest';
import {
	buildPayoutPreview,
	canActAsEscrowOwner,
	canPayTournamentPrizes,
	defaultPlaceSplit,
	describeEscrowWallet,
	pickFinalMatch,
	placeTeamsFromFinal,
	shouldSkipPrizeAllocation
} from '@/lib/prize-places';
import { payoutIdempotencyKey } from '@/server/db/idempotency';
import { shouldSkipIdempotentPayout } from '@/lib/concurrency-policy';

const winnersFinal = {
	bracket: 'winners',
	winnerTeamId: 'alpha',
	teamAId: 'alpha',
	teamBId: 'beta',
	nextMatchId: null
};

const grandFinal = {
	bracket: 'grand',
	winnerTeamId: 'gamma',
	teamAId: 'delta',
	teamBId: 'gamma',
	nextMatchId: null
};

describe('prize places', () => {
	it('prefers the grand final over the winners final', () => {
		expect(pickFinalMatch([winnersFinal, grandFinal])).toEqual(grandFinal);
	});

	it('falls back to a winners match without a next slot', () => {
		expect(pickFinalMatch([winnersFinal])).toEqual(winnersFinal);
	});

	it('places winner and runner-up from the final', () => {
		expect(placeTeamsFromFinal(grandFinal)).toEqual({ 1: 'gamma', 2: 'delta' });
	});

	it('allows payout only on a finished tournament with a winner', () => {
		expect(canPayTournamentPrizes('LIVE', grandFinal)).toEqual({ ok: false, reason: 'not_finished' });
		expect(canPayTournamentPrizes('FINISHED', { ...grandFinal, winnerTeamId: null })).toEqual({
			ok: false,
			reason: 'no_winner'
		});
		expect(canPayTournamentPrizes('FINISHED', grandFinal)).toEqual({ ok: true, finalMatch: grandFinal });
	});

	it('pays only reserved escrow so unconfirmed or already paid rows do not create money', () => {
		expect(shouldSkipPrizeAllocation('PAID', 500)).toBe(true);
		expect(shouldSkipPrizeAllocation('VOID', 500)).toBe(true);
		expect(shouldSkipPrizeAllocation('PENDING', 500)).toBe(true);
		expect(shouldSkipPrizeAllocation('PENDING', 0)).toBe(true);
		expect(shouldSkipPrizeAllocation('RESERVED', 500)).toBe(false);
	});

	it('asks the organizer to confirm a reserved payout and blocks an unconfirmed fund', () => {
		expect(
			buildPayoutPreview({
				tournamentStatus: 'FINISHED',
				prizeStatus: 'CONFIRMED',
				allocations: [{ place: 1, amount: 7000, status: 'RESERVED' }],
				finalMatch: grandFinal,
				teamNames: { gamma: 'Гамма' }
			})
		).toMatchObject({
			canPay: true,
			canReserve: false,
			lines: [{ place: 1, teamName: 'Гамма', payable: true }]
		});
		expect(
			buildPayoutPreview({
				tournamentStatus: 'FINISHED',
				prizeStatus: 'UNCONFIRMED',
				allocations: [{ place: 1, amount: 7000, status: 'PENDING' }],
				finalMatch: grandFinal
			})
		).toMatchObject({ canPay: false, canReserve: true, reason: 'unconfirmed' });
	});

	it('shows the organizer shortfall on a live unconfirmed cup instead of only «wait for finish»', () => {
		const preview = buildPayoutPreview({
			tournamentStatus: 'LIVE',
			prizeStatus: 'UNCONFIRMED',
			prizePool: 1_500_000,
			organizerBalance: 12_000,
			allocations: [],
			actorId: 'owner',
			ownerId: 'owner'
		});
		expect(preview.canPay).toBe(false);
		expect(preview.canReserve).toBe(true);
		expect(preview.escrowReady).toBe(false);
		expect(preview.wallet.shortfall).toBe(1_488_000);
		expect(preview.lines).toHaveLength(2);
		expect(preview.hint).toMatch(/не хватает/i);
		expect(preview.hint).toMatch(/финала/i);
		expect(
			buildPayoutPreview({
				tournamentStatus: 'LIVE',
				prizeStatus: 'UNCONFIRMED',
				prizePool: 1_500_000,
				organizerBalance: 12_000,
				allocations: [],
				actorId: 'ref',
				ownerId: 'owner',
				actorRole: 'USER'
			}).canReserve
		).toBe(false);
	});

	it('does not invent escrow money and only lets the owner or admin reserve', () => {
		expect(defaultPlaceSplit(1_500_000)).toEqual([
			{ place: 1, amount: 1_050_000 },
			{ place: 2, amount: 450_000 }
		]);
		expect(describeEscrowWallet({ prizePool: 1_500_000, balance: 12_000 }).canAfford).toBe(false);
		expect(describeEscrowWallet({ prizePool: 1_500_000, balance: 1_500_000 }).canAfford).toBe(true);
		expect(canActAsEscrowOwner({ actorId: 'owner', ownerId: 'owner' })).toBe(true);
		expect(canActAsEscrowOwner({ actorId: 'ref', ownerId: 'owner', actorRole: 'ORGANIZER' })).toBe(false);
		expect(canActAsEscrowOwner({ actorId: 'admin', ownerId: 'owner', actorRole: 'ADMIN' })).toBe(true);
		expect(canActAsEscrowOwner({ actorId: 'x', ownerId: null })).toBe(false);
	});

	it('second payout call skips rows that already have ledger keys', () => {
		const key = payoutIdempotencyKey('cup-1', 1);
		expect(key).toBe('prize_pay:cup-1:1');
		expect(shouldSkipIdempotentPayout('RESERVED', true)).toBe(true);
		expect(shouldSkipIdempotentPayout('PAID', false)).toBe(true);
	});
});
