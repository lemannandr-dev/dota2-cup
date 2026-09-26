import { ARENA_RATING_LOSS, ARENA_RATING_WIN, arenaRatingFromResults } from '@/lib/arena-rating';
import { shouldReplaySettledReport } from '@/lib/report-replay';

export type ScrimGate = {
	status: string;
	matchStatus?: string | null;
};

const CLOSED_MATCH = new Set(['COMPLETED', 'TECHNICAL']);

/** Pending invite or an accepted pair that is not closed yet. */
export function scrimGateOpen(row: ScrimGate) {
	if (row.status === 'PENDING' || row.status === 'COUNTERED') return true;
	if (row.status !== 'ACCEPTED') return false;
	if (!row.matchStatus) return true;
	return !CLOSED_MATCH.has(row.matchStatus);
}

export function scrimChallengeRejected(rows: ScrimGate[]) {
	return rows.some(scrimGateOpen);
}

/** A scrim is a match without a cup, so it cannot reserve or pay a prize. */
export function scrimPaysPrize() {
	return false;
}

/** One closed match is one rating row. A replayed report does not add a second game. */
export function scrimRatingAfterClose(input: { matchId: string; won: boolean; replayed: boolean }) {
	if (input.replayed) return null;
	const summary = arenaRatingFromResults([{ won: input.won }]);
	return {
		matchId: input.matchId,
		delta: input.won ? ARENA_RATING_WIN : -ARENA_RATING_LOSS,
		games: summary.games
	};
}

export function scrimReportIsReplay(status: string, reports: Array<{ teamId: string; scoreA: number; scoreB: number }>, teamId: string, scoreA: number, scoreB: number) {
	return shouldReplaySettledReport(status, reports, teamId, scoreA, scoreB);
}
