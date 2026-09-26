export type ClosedCheckInDecision = 'wait' | 'generate' | 'cancel';

export function decideClosedCheckIn(input: {
	status: string;
	checkInClosesAt: Date | string | null;
	existingMatchCount: number;
	checkedInCount: number;
	now?: Date;
}): ClosedCheckInDecision {
	if (input.status !== 'CHECK_IN') return 'wait';
	if (!input.checkInClosesAt) return 'wait';
	const closesAt = new Date(input.checkInClosesAt);
	const now = input.now ?? new Date();
	if (closesAt > now) return 'wait';
	if (input.existingMatchCount > 0) return 'wait';
	if (input.checkedInCount >= 2) return 'generate';
	return 'cancel';
}

export const SYSTEM_TICK_ACTOR = 'system';
