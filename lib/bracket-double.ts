import { MatchStatus, type Prisma } from '@prisma/client';
import { prisma } from './prisma';
import { nextPowerOfTwo, seedOrder } from './bracket-pure';
import type { SeededTeam } from './bracket';

type Created = { id: string; round: number; position: number; bracket: string };
type Tx = Prisma.TransactionClient;

async function runBracketTx<T>(db: Tx | undefined, fn: (tx: Tx) => Promise<T>) {
	if (db) return fn(db);
	return prisma.$transaction(fn);
}

export async function generateDoubleElimination(
	tournamentId: string,
	teams: SeededTeam[],
	bestOf = 1,
	externalDb?: Tx
) {
	if (teams.length < 2) throw new Error('Need at least 2 teams');
	if (teams.length < 4) {
		const { generateSingleElimination } = await import('./bracket');
		return generateSingleElimination(tournamentId, teams, bestOf, externalDb);
	}

	const sorted = [...teams].sort((a, b) => a.seed - b.seed);
	const size = nextPowerOfTwo(sorted.length);
	const order = seedOrder(size);
	const slots: (SeededTeam | null)[] = order.map((seed) => sorted[seed - 1] ?? null);
	const wbRounds = Math.log2(size);

	return runBracketTx(externalDb, async (db) => {
		await db.match.deleteMany({ where: { tournamentId } });

		const winners: Created[] = [];
		for (let round = 1; round <= wbRounds; round++) {
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
				winners.push({ id: m.id, round, position: pos, bracket: 'winners' });
			}
		}

		const losers: Created[] = [];
		const lbRounds = wbRounds * 2 - 2;
		for (let round = 1; round <= lbRounds; round++) {
			const isDropRound = round % 2 === 0;
			const wbSourceRound = isDropRound ? round / 2 + 1 : (round + 1) / 2;
			const matchCount = Math.max(1, size / Math.pow(2, wbSourceRound + (isDropRound ? 0 : 1)));
			for (let pos = 0; pos < matchCount; pos++) {
				const m = await db.match.create({
					data: {
						tournamentId,
						round,
						position: pos,
						bracket: 'losers',
						bestOf,
						status: MatchStatus.PENDING
					}
				});
				losers.push({ id: m.id, round, position: pos, bracket: 'losers' });
			}
		}

		const grand = await db.match.create({
			data: {
				tournamentId,
				round: 1,
				position: 0,
				bracket: 'grand',
				bestOf: Math.max(bestOf, 3),
				status: MatchStatus.PENDING
			}
		});

		for (const m of winners) {
			if (m.round < wbRounds) {
				const next = winners.find((c) => c.round === m.round + 1 && c.position === Math.floor(m.position / 2));
				if (next) {
					await db.match.update({
						where: { id: m.id },
						data: { nextMatchId: next.id, nextMatchSlot: m.position % 2 === 0 ? 'A' : 'B' }
					});
				}
			} else {
				await db.match.update({
					where: { id: m.id },
					data: { nextMatchId: grand.id, nextMatchSlot: 'A' }
				});
			}

			const loserRound = m.round === 1 ? 1 : m.round * 2 - 2;
			const loserPos = m.round === 1 ? Math.floor(m.position / 2) : m.position;
			const loserMatch = losers.find((l) => l.round === loserRound && l.position === loserPos);
			if (loserMatch) {
				await db.match.update({
					where: { id: m.id },
					data: {
						nextLoserMatchId: loserMatch.id,
						nextLoserSlot: m.round === 1 ? (m.position % 2 === 0 ? 'A' : 'B') : 'B'
					}
				});
			}
		}

		for (const m of losers) {
			if (m.round < lbRounds) {
				const next = losers.find((c) => c.round === m.round + 1 && c.position === Math.floor(m.position / 2));
				if (next) {
					await db.match.update({
						where: { id: m.id },
						data: { nextMatchId: next.id, nextMatchSlot: m.round % 2 === 1 ? (m.position % 2 === 0 ? 'A' : 'B') : 'A' }
					});
				}
			} else {
				await db.match.update({
					where: { id: m.id },
					data: { nextMatchId: grand.id, nextMatchSlot: 'B' }
				});
			}
		}

		const round1 = winners.filter((c) => c.round === 1).sort((a, b) => a.position - b.position);
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

		return winners.length + losers.length + 1;
	});
}
