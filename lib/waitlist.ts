const COUNTED = new Set(['SUBMITTED', 'NEEDS_ACTION', 'APPROVED', 'CHECKED_IN', 'IN_BRACKET']);

export function countedApplicationStatus(status: string) {
	return COUNTED.has(status);
}

export function canJoinWaitlist(input: { counted: number; maxTeams: number; tournamentStatus: string }) {
	return input.tournamentStatus === 'REGISTRATION' && input.counted >= input.maxTeams;
}

export function canPromoteWaitlist(input: { counted: number; maxTeams: number; applicationStatus: string; tournamentStatus: string }) {
	if (input.applicationStatus !== 'WAITLIST') return false;
	if (!['REGISTRATION', 'CHECK_IN'].includes(input.tournamentStatus)) return false;
	return input.counted < input.maxTeams;
}
