import { prisma } from '@/lib/prisma';
import { PrizeAllocationStatus, TransactionType } from '@prisma/client';
import { canPayTournamentPrizes, pickFinalMatch, placeTeamsFromFinal, shouldSkipPrizeAllocation } from '@/lib/prize-places';
import { shouldSkipIdempotentPayout } from '@/lib/concurrency-policy';
import { DomainError } from '@/server/errors';
import { lockTournamentRow, lockUserBalanceRow } from '@/server/db/advisory-lock';
import { hasIdempotencyKey, payoutIdempotencyKey } from '@/server/db/idempotency';

export async function payTournamentPrizes(tournamentId: string, actorId: string) {
	return prisma.$transaction(async (db) => {
		await lockTournamentRow(db, tournamentId);

		const tournament = await db.tournament.findUnique({
			where: { id: tournamentId },
			include: {
				matches: { orderBy: [{ bracket: 'asc' }, { round: 'desc' }, { position: 'asc' }] },
				prizeAllocations: true
			}
		});
		if (!tournament) throw new DomainError('Турнир не найден', 404);
		if (tournament.prizeStatus !== 'CONFIRMED') {
			throw new DomainError(
				tournament.prizeStatus === 'UNCONFIRMED'
					? 'Фонд не зарезервирован: на балансе орга не хватило при публикации'
					: 'Призового фонда нет',
				400
			);
		}
		const gate = canPayTournamentPrizes(tournament.status, pickFinalMatch(tournament.matches));
		if (!gate.ok) {
			throw new DomainError(
				gate.reason === 'not_finished'
					? 'Выплата возможна только после завершения турнира'
					: 'Победитель турнира ещё не определён',
				400
			);
		}
		const placeTeam = placeTeamsFromFinal(gate.finalMatch);

		const paid: string[] = [];
		for (const allocation of tournament.prizeAllocations) {
			if (shouldSkipPrizeAllocation(allocation.status, allocation.amount)) continue;
			const teamId = placeTeam[allocation.place] ?? allocation.teamId;
			if (!teamId) continue;
			const team = await db.team.findUnique({ where: { id: teamId }, select: { createdById: true, name: true } });
			if (!team) continue;

			const idemKey = payoutIdempotencyKey(tournamentId, allocation.place);
			const ledgerExists = await hasIdempotencyKey(db, team.createdById, idemKey);
			if (shouldSkipIdempotentPayout(allocation.status, ledgerExists)) {
				if (allocation.status !== 'PAID' && ledgerExists) {
					await db.prizeAllocation.update({
						where: { id: allocation.id },
						data: { teamId, status: PrizeAllocationStatus.PAID, paidAt: new Date() }
					});
					paid.push(allocation.id);
				}
				continue;
			}

			await lockUserBalanceRow(db, team.createdById);
			const captain = await db.user.findUnique({ where: { id: team.createdById }, select: { balance: true } });
			if (!captain) continue;
			const newBalance = captain.balance + allocation.amount;
			await db.user.update({
				where: { id: team.createdById },
				data: { balance: newBalance, totalEarned: { increment: allocation.amount } }
			});
			await db.transaction.create({
				data: {
					userId: team.createdById,
					amount: allocation.amount,
					balance: newBalance,
					description: `Приз ${allocation.place} место: ${tournament.title}`,
					type: TransactionType.EARNED,
					metadata: { tournamentId, teamId, place: allocation.place, idempotencyKey: idemKey }
				}
			});
			await db.prizeAllocation.update({
				where: { id: allocation.id },
				data: { teamId, status: PrizeAllocationStatus.PAID, paidAt: new Date() }
			});
			paid.push(allocation.id);
		}

		await db.auditLog.create({
			data: {
				actorId,
				action: 'PRIZE_PAID',
				entity: 'Tournament',
				entityId: tournamentId,
				payload: { paid }
			}
		});

		return { paid: paid.length };
	});
}
