export const REPORT_WINDOW_MS = 3 * 60 * 60 * 1000;

export function computeReportDeadline(
	assignedAt: Date,
	tournamentStartAt?: Date | string | null,
	windowMs = REPORT_WINDOW_MS
) {
	const start = tournamentStartAt ? new Date(tournamentStartAt) : assignedAt;
	const base = start > assignedAt ? start : assignedAt;
	return new Date(base.getTime() + windowMs);
}

export type ExpiredReportDecision =
	| { action: 'wait' }
	| { action: 'accept_report'; scoreA: number; scoreB: number };

export function decideExpiredReport(input: {
	now?: Date;
	deadline?: Date | string | null;
	status: string;
	teamAId?: string | null;
	teamBId?: string | null;
	reports: Array<{ teamId: string; scoreA: number; scoreB: number }>;
}): ExpiredReportDecision {
	if (!input.deadline) return { action: 'wait' };
	const now = input.now ?? new Date();
	if (new Date(input.deadline) > now) return { action: 'wait' };
	if (['COMPLETED', 'TECHNICAL', 'NEEDS_REVIEW'].includes(input.status)) return { action: 'wait' };
	if (!input.teamAId || !input.teamBId) return { action: 'wait' };
	if (input.reports.length !== 1) return { action: 'wait' };
	const report = input.reports[0];
	return { action: 'accept_report', scoreA: report.scoreA, scoreB: report.scoreB };
}
