import { prisma } from '@/lib/prisma';
import { canSubmitMatchScore } from '@/lib/access-policy';
import { reportResult, reportResultInTx } from '@/lib/bracket';
import { DomainError } from '@/server/errors';
import { decideReportOutcome } from '@/server/matches/score';
import { fetchOpenDotaMatch, verifyMatchRosters } from '@/server/matches/verify-opendota';
import { publishTournamentEvent } from '@/server/realtime/publish';
import { recomputeArenaRatingsForTeams } from '@/server/rating/recompute';
import { notifyScrimParties } from '@/server/scrims/notify';
import { notifyMatchParties } from '@/server/matches/notify';
import { freezeMatchRostersIfNeeded } from '@/server/matches/freeze-roster';
import { rosterFromSnapshot } from '@/lib/match-day';
import { noShowSeriesScore, type NoShowSide } from '@/lib/no-show';
import { deputyIdFromMembers } from '@/lib/team-roles';
import { lockMatchRow } from '@/server/db/advisory-lock';
import { shouldReplayOpenDispute, shouldReplaySettledReport } from '@/lib/report-replay';
import type { Prisma } from '@prisma/client';

function snapshotPlayers(snapshot: Prisma.JsonValue | null) {
	return rosterFromSnapshot(snapshot).map((row) => ({ steamId: row.steamId ?? null }));
}

export async function submitCaptainReport(
	matchId: string,
	userId: string,
	scoreA: number,
	scoreB: number,
	dotaMatchIds: string[] = []
) {
	const match = await prisma.match.findUnique({
		where: { id: matchId },
		include: {
			teamA: {
				select: {
					id: true,
					createdById: true,
					name: true,
					members: { where: { confirmed: true }, select: { userId: true, role: true } }
				}
			},
			teamB: {
				select: {
					id: true,
					createdById: true,
					name: true,
					members: { where: { confirmed: true }, select: { userId: true, role: true } }
				}
			},
			tournament: { select: { id: true, title: true, createdById: true } },
			reports: { select: { teamId: true, scoreA: true, scoreB: true, id: true, reporterId: true, dotaMatchIds: true, createdAt: true, matchId: true } }
		}
	});
	if (!match) throw new DomainError('Матч не найден', 404);

	const deputyA = match.teamA ? deputyIdFromMembers(match.teamA.members, match.teamA.createdById) : null;
	const deputyB = match.teamB ? deputyIdFromMembers(match.teamB.members, match.teamB.createdById) : null;
	if (!canSubmitMatchScore(userId, match.teamA?.createdById, match.teamB?.createdById, deputyA, deputyB)) {
		throw new DomainError('Счёт сдаёт капитан или заместитель участвующей команды', 403);
	}
	const teamId =
		match.teamA && (match.teamA.createdById === userId || deputyA === userId) ? match.teamA.id : match.teamB!.id;

	if (shouldReplaySettledReport(match.status, match.reports, teamId, scoreA, scoreB)) {
		const mine = match.reports.find((row) => row.teamId === teamId)!;
		return { report: mine, match, state: 'completed' as const, replayed: true };
	}
	if (shouldReplayOpenDispute(match.status, match.reports, teamId, scoreA, scoreB)) {
		const mine = match.reports.find((row) => row.teamId === teamId)!;
		return { report: mine, match, state: 'dispute' as const, replayed: true };
	}
	if (match.status === 'COMPLETED' || match.status === 'TECHNICAL') {
		throw new DomainError('Матч уже завершён', 400);
	}

	await freezeMatchRostersIfNeeded(matchId);
	const frozen = await prisma.match.findUnique({
		where: { id: matchId },
		select: { rosterA: true, rosterB: true }
	});

	if (dotaMatchIds.length > 0 && match.tournamentId && !match.scrim) {
		const [appA, appB] = await Promise.all([
			match.teamAId
				? prisma.teamApplication.findUnique({
						where: { teamId_tournamentId: { teamId: match.teamAId, tournamentId: match.tournamentId } }
					})
				: null,
			match.teamBId
				? prisma.teamApplication.findUnique({
						where: { teamId_tournamentId: { teamId: match.teamBId, tournamentId: match.tournamentId } }
					})
				: null
		]);
		for (const id of dotaMatchIds) {
			const od = await fetchOpenDotaMatch(id);
			if (!od) {
				await prisma.match.update({ where: { id: matchId }, data: { status: 'NEEDS_REVIEW' } });
				throw new DomainError(`OpenDota не нашла матч ${id}`, 400);
			}
			const verified = verifyMatchRosters(
				od,
				snapshotPlayers(frozen?.rosterA ?? appA?.rosterSnapshot ?? null),
				snapshotPlayers(frozen?.rosterB ?? appB?.rosterSnapshot ?? null)
			);
			if (!verified.ok) {
				await prisma.match.update({ where: { id: matchId }, data: { status: 'NEEDS_REVIEW' } });
				throw new DomainError(verified.reason || 'Катка не подтверждена', 400);
			}
		}
	}

	const outcome = await prisma.$transaction(async (db) => {
		await lockMatchRow(db, matchId);
		const locked = await db.match.findUnique({
			where: { id: matchId },
			include: {
				teamA: { select: { id: true, createdById: true, name: true } },
				teamB: { select: { id: true, createdById: true, name: true } },
				reports: true,
				tournament: { select: { id: true, title: true, createdById: true } }
			}
		});
		if (!locked) throw new DomainError('Матч не найден', 404);
		if (locked.status === 'COMPLETED' || locked.status === 'TECHNICAL') {
			throw new DomainError('Матч уже завершён', 400);
		}

		const report = await db.matchReport.upsert({
			where: { matchId_teamId: { matchId, teamId } },
			update: { scoreA, scoreB, dotaMatchIds, reporterId: userId },
			create: { matchId, teamId, reporterId: userId, scoreA, scoreB, dotaMatchIds }
		});

		const reports = await db.matchReport.findMany({ where: { matchId } });
		const a = reports.find((r) => r.teamId === locked.teamAId) ?? null;
		const b = reports.find((r) => r.teamId === locked.teamBId) ?? null;
		const decision = decideReportOutcome(a, b);

		if (decision.action === 'advance') {
			const updated = await reportResultInTx(db, matchId, decision.scoreA, decision.scoreB, userId);
			if (dotaMatchIds.length) {
				await db.match.update({ where: { id: matchId }, data: { dotaMatchIds } });
			}
			return {
				report,
				match: updated,
				state: 'completed' as const,
				tournament: locked.tournament,
				teamA: locked.teamA,
				teamB: locked.teamB,
				scoreA: decision.scoreA,
				scoreB: decision.scoreB
			};
		}

		if (decision.action === 'dispute') {
			const alreadyDisputed = locked.status === 'NEEDS_REVIEW';
			if (!alreadyDisputed) {
				await db.match.update({ where: { id: matchId }, data: { status: 'NEEDS_REVIEW' } });
				await db.dispute.create({
					data: {
						matchId,
						openedById: userId,
						reason: 'WRONG_RESULT',
						details: 'Капитаны сдали разный счёт'
					}
				});
			}
			return {
				report,
				match: { ...locked, status: 'NEEDS_REVIEW' as const },
				state: 'dispute' as const,
				tournament: locked.tournament,
				teamA: locked.teamA,
				teamB: locked.teamB,
				matchId,
				replayed: alreadyDisputed
			};
		}

		const nextStatus = locked.status === 'PENDING' ? 'SCHEDULED' : locked.status;
		await db.match.update({
			where: { id: matchId },
			data: { status: nextStatus, dotaMatchIds }
		});
		return {
			report,
			match: { ...locked, status: nextStatus },
			state: 'waiting' as const,
			tournament: locked.tournament,
			teamA: locked.teamA,
			teamB: locked.teamB,
			matchId,
			scoreA,
			scoreB
		};
	});

	if (outcome.state === 'completed') {
		if (match.scrim) {
			await notifyScrimParties(matchId, 'Скрим закрыт', `Счёт ${outcome.scoreA}:${outcome.scoreB}. Приза нет. Рейтинг арены +16/−12.`);
		} else if (outcome.tournament) {
			await publishTournamentEvent(outcome.tournament.id, 'match_completed', { matchId });
			await notifyMatchParties({
				kind: 'score_completed',
				actorId: userId,
				tournamentId: outcome.tournament.id,
				tournamentTitle: outcome.tournament.title,
				ownerId: outcome.tournament.createdById,
				teamA: outcome.teamA,
				teamB: outcome.teamB,
				scoreA: outcome.scoreA,
				scoreB: outcome.scoreB
			});
		}
		await recomputeArenaRatingsForTeams([match.teamAId, match.teamBId]);
		return { report: outcome.report, match: outcome.match, state: outcome.state };
	}

	if (outcome.state === 'dispute') {
		if (!('replayed' in outcome && outcome.replayed)) {
			if (match.scrim) {
				await notifyScrimParties(matchId, 'Спор скрима', 'Капитаны сдали разный счёт. Приза у скрима нет.');
			} else if (outcome.tournament) {
				await publishTournamentEvent(outcome.tournament.id, 'match_dispute', { matchId });
				await notifyMatchParties({
					kind: 'score_dispute',
					actorId: userId,
					tournamentId: outcome.tournament.id,
					tournamentTitle: outcome.tournament.title,
					ownerId: outcome.tournament.createdById,
					matchId,
					teamA: outcome.teamA,
					teamB: outcome.teamB
				});
			}
		}
		return { report: outcome.report, match: outcome.match, state: outcome.state };
	}

	if (match.scrim) {
		await notifyScrimParties(matchId, 'Счёт скрима', 'Один капитан сдал счёт. Второй должен сдать тот же.');
	} else if (outcome.tournament) {
		await publishTournamentEvent(outcome.tournament.id, 'match_report', { matchId, waiting: true });
		await notifyMatchParties({
			kind: 'score_waiting',
			actorId: userId,
			tournamentId: outcome.tournament.id,
			tournamentTitle: outcome.tournament.title,
			ownerId: outcome.tournament.createdById,
			matchId,
			teamA: outcome.teamA,
			teamB: outcome.teamB,
			scoreA: outcome.scoreA,
			scoreB: outcome.scoreB
		});
	}
	return { report: outcome.report, match: outcome.match, state: outcome.state };
}

export async function forceMatchResult(
	matchId: string,
	actorId: string,
	scoreA: number,
	scoreB: number,
	technical = false,
	forfeit?: NoShowSide
) {
	if (forfeit) {
		const pair = await prisma.match.findUnique({ where: { id: matchId }, select: { bestOf: true } });
		if (!pair) throw new DomainError('Матч не найден', 404);
		const preset = noShowSeriesScore(pair.bestOf, forfeit);
		scoreA = preset.scoreA;
		scoreB = preset.scoreB;
		technical = true;
	}
	await freezeMatchRostersIfNeeded(matchId);
	const updated = await reportResult(matchId, scoreA, scoreB, actorId);
	if (technical) {
		await prisma.match.update({ where: { id: matchId }, data: { status: 'TECHNICAL' } });
	}
	if (forfeit) {
		await prisma.auditLog.create({
			data: {
				actorId,
				action: 'MATCH_NO_SHOW_STAFF',
				entity: 'Match',
				entityId: matchId,
				payload: { forfeit, scoreA, scoreB }
			}
		});
	}
	const match = await prisma.match.findUnique({
		where: { id: matchId },
		include: {
			teamA: { select: { createdById: true, name: true } },
			teamB: { select: { createdById: true, name: true } },
			tournament: { select: { id: true, title: true, createdById: true } }
		}
	});
	if (match?.scrim) {
		await notifyScrimParties(matchId, 'Скрим закрыт', `Счёт ${scoreA}:${scoreB}. Приза нет.`);
	} else if (match?.tournament) {
		await publishTournamentEvent(match.tournament.id, 'match_completed', { matchId, forced: true });
		await notifyMatchParties({
			kind: 'score_forced',
			actorId,
			tournamentId: match.tournament.id,
			tournamentTitle: match.tournament.title,
			ownerId: match.tournament.createdById,
			teamA: match.teamA,
			teamB: match.teamB,
			scoreA,
			scoreB
		});
	}
	await recomputeArenaRatingsForTeams([match?.teamAId, match?.teamBId]);
	return updated;
}
