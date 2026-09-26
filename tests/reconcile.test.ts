import { describe, expect, it } from 'vitest';
import { reconcileBalances } from '@/server/finance/reconcile';

describe('reconcile balances', () => {
	it('exports reconcile helper', () => {
		expect(typeof reconcileBalances).toBe('function');
	});
});
