/** Pure guard: bracket must not be generated twice for the same tournament. */
export function shouldSkipBracketGeneration(existingMatchCount: number) {
	return existingMatchCount > 0;
}

/** Pure guard: payout row already settled. */
export function shouldSkipIdempotentPayout(allocationStatus: string, hasLedgerEntry: boolean) {
	if (allocationStatus === 'PAID' || allocationStatus === 'VOID') return true;
	return hasLedgerEntry;
}
