export function shouldResetOrphanPrize(input: { hadOwner: boolean; prizeStatus: string; hasEscrowTx: boolean }) {
	if (input.hadOwner) return false;
	return input.prizeStatus === 'CONFIRMED' && !input.hasEscrowTx;
}
