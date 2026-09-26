import { describe, expect, it } from 'vitest';
import { ledgerTxMatches, transactionsToCsv } from '@/lib/admin-ledger';

describe('admin ledger filters', () => {
	const row = {
		description: 'Эскроу призового фонда: Clash',
		type: 'SPENT',
		userName: 'o555aa',
		createdAt: '2026-08-24T10:00:00.000Z'
	};

	it('filters by type, user and query', () => {
		expect(ledgerTxMatches(row, { type: 'SPENT', user: '555', q: 'clash' })).toBe(true);
		expect(ledgerTxMatches(row, { type: 'DEPOSIT' })).toBe(false);
		expect(ledgerTxMatches(row, { user: 'other' })).toBe(false);
	});

	it('writes csv without inventing amounts', () => {
		const csv = transactionsToCsv([
			{ createdAt: row.createdAt, who: 'o555aa', type: 'SPENT', description: 'эскроу', amount: -1500000 }
		]);
		expect(csv).toContain('o555aa');
		expect(csv).toContain('-1500000');
	});
});
