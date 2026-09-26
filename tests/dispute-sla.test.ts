import { describe, expect, it } from 'vitest';
import { disputeAgeMinutes, isDisputeStale, disputeSlaLabel } from '@/lib/dispute-sla';

describe('dispute sla', () => {
	it('marks open dispute stale after 60 minutes', () => {
		const created = new Date('2026-08-25T10:00:00.000Z');
		const now = new Date('2026-08-25T11:05:00.000Z');
		expect(disputeAgeMinutes(created, now)).toBe(65);
		expect(isDisputeStale(created, now)).toBe(true);
		expect(disputeSlaLabel(created, now)).toBe('1 ч');
	});
});
