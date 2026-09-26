export function canEditTournamentFields(status: string) {
	return ['DRAFT', 'REGISTRATION', 'CHECK_IN'].includes(status);
}

export function nextPrizeStatusAfterPoolChange(
	prev: { prizePool: number; prizeStatus: string },
	nextPool: number
) {
	if (nextPool <= 0) return 'NONE';
	if (prev.prizeStatus === 'CONFIRMED' && nextPool > prev.prizePool) return 'UNCONFIRMED';
	if (prev.prizeStatus === 'CONFIRMED') return 'CONFIRMED';
	return 'UNCONFIRMED';
}
