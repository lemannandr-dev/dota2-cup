export const BALLOT_APPLICATION_STATUSES = ['SUBMITTED', 'NEEDS_ACTION', 'APPROVED', 'CHECKED_IN', 'IN_BRACKET'] as const;

export type RefereeSeat = 'owner' | 'referee' | 'open';

export function ballotOpen(tournamentStatus: string) {
	return tournamentStatus !== 'FINISHED' && tournamentStatus !== 'CANCELLED' && tournamentStatus !== 'DRAFT';
}

export function refereeSeat(input: { userId: string; ownerId?: string | null; staffRole?: string | null }): RefereeSeat {
	if (input.ownerId && input.userId === input.ownerId) return 'owner';
	if (input.staffRole === 'REFEREE' || input.staffRole === 'ADMIN' || input.staffRole === 'OWNER') return 'referee';
	return 'open';
}

export function refereeRatingLabel(rating: number, games: number) {
	if (games <= 0) return `рейтинг арены ${rating} · игр нет`;
	return `рейтинг арены ${rating} · ${games} игр`;
}

export function canNominateReferee(input: { tournamentStatus: string; isCaptain: boolean }) {
	return input.isCaptain && ballotOpen(input.tournamentStatus);
}

export function canVoteReferee(input: { tournamentStatus: string; isCaptain: boolean }) {
	return input.isCaptain && ballotOpen(input.tournamentStatus);
}

export function pickBallotLeader<T extends { id: string; votes: number }>(rows: T[]): T | null {
	if (rows.length === 0) return null;
	const sorted = [...rows].sort((a, b) => b.votes - a.votes || a.id.localeCompare(b.id));
	if (sorted[0].votes <= 0) return null;
	if (sorted[1] && sorted[1].votes === sorted[0].votes) return null;
	return sorted[0];
}
