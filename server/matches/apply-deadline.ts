import { prisma } from '@/lib/prisma';
import { decideExpiredReport } from '@/lib/match-deadline';
import { SYSTEM_TICK_ACTOR } from '@/lib/tournament-tick-policy';
import { forceMatchResult } from '@/server/matches/report';

export async function applyExpiredReportDeadlines(now = new Date()) {
	const matches = await prisma.match.findMany({
		where: {
			reportDeadlineAt: { lte: now },
			status: { in: ['SCHEDULED', 'PENDING'] },
			teamAId: { not: null },
			teamBId: { not: null }
		},
		select: {
			id: true,
			status: true,
			teamAId: true,
			teamBId: true,
			reportDeadlineAt: true,
			reports: { select: { teamId: true, scoreA: true, scoreB: true } }
		}
	});

	let applied = 0;
	for (const match of matches) {
		const decision = decideExpiredReport({
			now,
			deadline: match.reportDeadlineAt,
			status: match.status,
			teamAId: match.teamAId,
			teamBId: match.teamBId,
			reports: match.reports
		});
		if (decision.action !== 'accept_report') continue;
		await forceMatchResult(match.id, SYSTEM_TICK_ACTOR, decision.scoreA, decision.scoreB, true);
		await prisma.auditLog.create({
			data: {
				actorId: SYSTEM_TICK_ACTOR,
				action: 'MATCH_NO_SHOW_DEADLINE',
				entity: 'Match',
				entityId: match.id,
				payload: { scoreA: decision.scoreA, scoreB: decision.scoreB }
			}
		});
		applied += 1;
	}
	return applied;
}
