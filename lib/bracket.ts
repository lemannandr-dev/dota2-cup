// Bracket engine: single-elimination generation with seeding and BYE handling.
// Progression happens only through reportResult, never by direct DB edits.
import { prisma } from './prisma';
import { MatchStatus, type Prisma } from '@prisma/client';
import { nextPowerOfTwo, seedOrder, validateSeriesScore, winnerFromScores } from './bracket-pure';
import { computeReportDeadline } from './match-deadline';

export interface SeededTeam {
	teamId: string;
	seed: number;
}

export { nextPowerOfTwo, seedOrder } from './bracket-pure';

type Tx = Prisma.TransactionClient;

async function runBracketTx<T>(db: Tx | undefined, fn: (tx: Tx) => Promise<T>) {
	if (db) return fn(db);
	return prisma.$transaction(fn);
}

export async function generateSingleElimination(
	tournamentId: string,
	teams: SeededTeam[],
	bestOf = 1,
	externalDb?: Tx
) {
	if (teams.length < 2) throw new Error('Need at least 2 teams');

	const sorted = [...teams].sort((a, b) => a.seed - b.seed);
	const size = nextPowerOfTwo(sorted.length);
	const order = seedOrder(size);
	const rounds = Math.log2(size);

	const slots: (SeededTeam | null)[] = order.map((seed) => sorted[seed - 1] ?? null);

	return runBracketTx(externalDb, async (db) => {
		await db.match.deleteMany({ where: { tournamentId } });

		const created: { id: string; round: number; position: number }[] = [];
		for (let round = 1; round <= rounds; round++) {
			const matchCount = size / Math.pow(2, round);
			for (let pos = 0; pos < matchCount; pos++) {
				const m = await db.match.create({
					data: {
						tournamentId,
						round,
						position: pos,
						bracket: 'winners',
						bestOf,
						status: MatchStatus.PENDING
					}
				});
				created.push({ id: m.id, round, position: pos });
			}
		}

		for (const m of created) {
			if (m.round === rounds) continue;
			const next = created.find((c) => c.round === m.round + 1 && c.position === Math.floor(m.position / 2));
			if (next) {
				await db.match.update({
					where: { id: m.id },
					data: { nextMatchId: next.id, nextMatchSlot: m.position % 2 === 0 ? 'A' : 'B' }
				});
			}
		}

		const round1 = created.filter((c) => c.round === 1).sort((a, b) => a.position - b.position);
		for (const m of round1) {
			const teamA = slots[m.position * 2];
			const teamB = slots[m.position * 2 + 1];
			await db.match.update({
				where: { id: m.id },
				data: {
					teamAId: teamA?.teamId ?? null,
					teamBId: teamB?.teamId ?? null,
					status: teamA && teamB ? MatchStatus.SCHEDULED : MatchStatus.COMPLETED
				}
			});

			const byeWinner = teamA && !teamB ? teamA : !teamA && teamB ? teamB : null;
			if (byeWinner) {
				const rec = await db.match.findUnique({ where: { id: m.id } });
				if (rec?.nextMatchId) {
					await db.match.update({
						where: { id: rec.nextMatchId },
						data: rec.nextMatchSlot === 'A' ? { teamAId: byeWinner.teamId } : { teamBId: byeWinner.teamId }
					});
				}
				await db.match.update({ where: { id: m.id }, data: { winnerTeamId: byeWinner.teamId } });
			}
		}

		await db.match.updateMany({
			where: { tournamentId, status: MatchStatus.PENDING, teamAId: { not: null }, teamBId: { not: null } },
			data: { status: MatchStatus.SCHEDULED }
		});

		return created.length;
	});
}

type ReportResultDb = Pick<typeof prisma, 'match' | 'tournament' | 'auditLog'>;

export async function reportResultInTx(
	db: ReportResultDb,
	matchId: string,
	scoreA: number,
	scoreB: number,
	actorId?: string
) {
	const match = await db.match.findUnique({ where: { id: matchId } });
	if (!match) throw new Error('Match not found');
	if (!match.teamAId || !match.teamBId) throw new Error('Match teams are not set');
	if (match.status === MatchStatus.COMPLETED || match.status === MatchStatus.TECHNICAL) {
		throw new Error('Match already completed');
	}

	const scoreError = validateSeriesScore(match.bestOf, scoreA, scoreB);
	if (scoreError) throw new Error(scoreError);

	const winnerTeamId = winnerFromScores(match.teamAId, match.teamBId, scoreA, scoreB);
	const loserTeamId = winnerTeamId === match.teamAId ? match.teamBId : match.teamAId;

	const updated = await db.match.update({
		where: { id: matchId },
		data: {
			scoreA,
			scoreB,
			winnerTeamId,
			status: MatchStatus.COMPLETED,
			finishedAt: new Date()
		}
	});

	if (match.nextMatchId) {
		await db.match.update({
			where: { id: match.nextMatchId },
			data: match.nextMatchSlot === 'A' ? { teamAId: winnerTeamId } : { teamBId: winnerTeamId }
		});
		const next = await db.match.findUnique({ where: { id: match.nextMatchId } });
		if (next?.teamAId && next?.teamBId && next.status === MatchStatus.PENDING) {
			const tournament = match.tournamentId
				? await db.tournament.findUnique({
						where: { id: match.tournamentId },
						select: { startAt: true }
					})
				: null;
			await db.match.update({
				where: { id: next.id },
				data: {
					status: MatchStatus.SCHEDULED,
					reportDeadlineAt: next.reportDeadlineAt ?? computeReportDeadline(new Date(), tournament?.startAt)
				}
			});
		}
	}

	if (match.nextLoserMatchId && loserTeamId) {
		await db.match.update({
			where: { id: match.nextLoserMatchId },
			data: match.nextLoserSlot === 'A' ? { teamAId: loserTeamId } : { teamBId: loserTeamId }
		});
		const loserNext = await db.match.findUnique({ where: { id: match.nextLoserMatchId } });
		if (loserNext?.teamAId && loserNext?.teamBId && loserNext.status === MatchStatus.PENDING) {
			const tournament = match.tournamentId
				? await db.tournament.findUnique({
						where: { id: match.tournamentId },
						select: { startAt: true }
					})
				: null;
			await db.match.update({
				where: { id: loserNext.id },
				data: {
					status: MatchStatus.SCHEDULED,
					reportDeadlineAt: loserNext.reportDeadlineAt ?? computeReportDeadline(new Date(), tournament?.startAt)
				}
			});
		}
	}

	await db.auditLog.create({
		data: {
			actorId: actorId ?? null,
			action: 'MATCH_RESULT_REPORTED',
			entity: 'Match',
			entityId: matchId,
			payload: { scoreA, scoreB, winnerTeamId }
		}
	});

	return updated;
}

export async function reportResult(matchId: string, scoreA: number, scoreB: number, actorId?: string) {
	return prisma.$transaction(async (db) => reportResultInTx(db, matchId, scoreA, scoreB, actorId));
}
