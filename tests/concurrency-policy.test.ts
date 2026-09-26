import { describe, expect, it, vi } from 'vitest';
import { shouldSkipBracketGeneration, shouldSkipIdempotentPayout } from '@/lib/concurrency-policy';
import { escrowIdempotencyKey, payoutIdempotencyKey } from '@/server/db/idempotency';
import { TOURNAMENT_TICK_LOCK_KEY, tryPgAdvisoryLock } from '@/server/db/advisory-lock';
import { prisma } from '@/lib/prisma';

describe('concurrency policy', () => {
	it('skips bracket generation when matches already exist', () => {
		expect(shouldSkipBracketGeneration(0)).toBe(false);
		expect(shouldSkipBracketGeneration(1)).toBe(true);
		expect(shouldSkipBracketGeneration(8)).toBe(true);
	});

	it('skips idempotent payout when PAID/VOID or ledger entry exists', () => {
		expect(shouldSkipIdempotentPayout('PAID', false)).toBe(true);
		expect(shouldSkipIdempotentPayout('VOID', false)).toBe(true);
		expect(shouldSkipIdempotentPayout('RESERVED', true)).toBe(true);
		expect(shouldSkipIdempotentPayout('RESERVED', false)).toBe(false);
	});

	it('uses stable idempotency keys for escrow and payout', () => {
		expect(escrowIdempotencyKey('cup-1')).toBe('prize_escrow:cup-1');
		expect(payoutIdempotencyKey('cup-1', 1)).toBe('prize_pay:cup-1:1');
		expect(payoutIdempotencyKey('cup-1', 2)).toBe('prize_pay:cup-1:2');
	});

	it('second tick advisory lock attempt returns false when held', async () => {
		const queryRaw = vi.spyOn(prisma, '$queryRaw');
		queryRaw.mockResolvedValueOnce([{ locked: true }]).mockResolvedValueOnce([{ locked: false }]);
		expect(await tryPgAdvisoryLock(TOURNAMENT_TICK_LOCK_KEY)).toBe(true);
		expect(await tryPgAdvisoryLock(TOURNAMENT_TICK_LOCK_KEY)).toBe(false);
		queryRaw.mockRestore();
	});
});
