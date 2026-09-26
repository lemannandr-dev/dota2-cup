/**
 * Pure guards for captain score submit retries after network loss.
 * Does not invent match outcomes — only recognizes an already-recorded state.
 */

export type ReplayReport = { teamId: string; scoreA: number; scoreB: number };

export function matchingTeamReport(
	reports: ReplayReport[],
	teamId: string,
	scoreA: number,
	scoreB: number
) {
	const mine = reports.find((row) => row.teamId === teamId);
	return Boolean(mine && mine.scoreA === scoreA && mine.scoreB === scoreB);
}

/** Safe to return success without writing when the match is already settled. */
export function shouldReplaySettledReport(
	matchStatus: string,
	reports: ReplayReport[],
	teamId: string,
	scoreA: number,
	scoreB: number
) {
	if (matchStatus !== 'COMPLETED' && matchStatus !== 'TECHNICAL') return false;
	return matchingTeamReport(reports, teamId, scoreA, scoreB);
}

/** Avoid opening a second Dispute row when NEEDS_REVIEW already reflects disagreement. */
export function shouldReplayOpenDispute(
	matchStatus: string,
	reports: ReplayReport[],
	teamId: string,
	scoreA: number,
	scoreB: number
) {
	if (matchStatus !== 'NEEDS_REVIEW') return false;
	return matchingTeamReport(reports, teamId, scoreA, scoreB);
}
