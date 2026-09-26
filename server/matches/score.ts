export type ScorePair = { scoreA: number; scoreB: number };

export type ReportDecision =
	| { action: 'wait' }
	| { action: 'advance'; scoreA: number; scoreB: number }
	| { action: 'dispute' };

export function decideReportOutcome(reportA: ScorePair | null, reportB: ScorePair | null): ReportDecision {
	if (!reportA || !reportB) return { action: 'wait' };
	if (reportA.scoreA === reportB.scoreA && reportA.scoreB === reportB.scoreB) {
		return { action: 'advance', scoreA: reportA.scoreA, scoreB: reportA.scoreB };
	}
	return { action: 'dispute' };
}

export function scoresEqual(a: ScorePair, b: ScorePair): boolean {
	return a.scoreA === b.scoreA && a.scoreB === b.scoreB;
}
