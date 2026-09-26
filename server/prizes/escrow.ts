import { prisma } from '@/lib/prisma';
import { TransactionType } from '@prisma/client';
import { DomainError } from '@/server/errors';
import { defaultPlaceSplit, describeEscrowWallet } from '@/lib/prize-places';
import { lockTournamentRow, lockUserBalanceRow } from '@/server/db/advisory-lock';
import { escrowIdempotencyKey, hasIdempotencyKey } from '@/server/db/idempotency';

export async function reservePrizePool(tournamentId: string, organizerId: string) {
	return prisma.$transaction(async (db) => {
		await lockTournamentRow(db, tournamentId);
		await lockUserBalanceRow(db, organizerId);

		const tournament = await db.tournament.findUnique({ where: { id: tournamentId } });
		if (!tournament) throw new DomainError('Турнир не найден', 404);
		if (tournament.prizePool <= 0) {
			await db.tournament.update({ where: { id: tournamentId }, data: { prizeStatus: 'NONE' } });
			return { reserved: false, prizeStatus: 'NONE' as const, ...describeEscrowWallet({ prizePool: 0, balance: 0 }) };
		}
		if (tournament.prizeStatus === 'CONFIRMED') {
			const organizer = await db.user.findUnique({ where: { id: organizerId }, select: { balance: true } });
			return {
				reserved: true,
				prizeStatus: 'CONFIRMED' as const,
				...describeEscrowWallet({ prizePool: tournament.prizePool, balance: organizer?.balance ?? 0 })
			};
		}

		const idemKey = escrowIdempotencyKey(tournamentId);
		if (await hasIdempotencyKey(db, organizerId, idemKey)) {
			const organizer = await db.user.findUnique({ where: { id: organizerId }, select: { balance: true } });
			return {
				reserved: true,
				prizeStatus: 'CONFIRMED' as const,
				...describeEscrowWallet({ prizePool: tournament.prizePool, balance: organizer?.balance ?? 0 })
			};
		}

		const organizer = await db.user.findUnique({ where: { id: organizerId }, select: { balance: true } });
		if (!organizer) throw new DomainError('Организатор не найден', 404);

		const splits = defaultPlaceSplit(tournament.prizePool);
		const wallet = describeEscrowWallet({ prizePool: tournament.prizePool, balance: organizer.balance });
		if (!wallet.canAfford) {
			await db.prizeAllocation.deleteMany({ where: { tournamentId } });
			for (const split of splits) {
				await db.prizeAllocation.create({
					data: { tournamentId, place: split.place, amount: split.amount, status: 'PENDING' }
				});
			}
			await db.tournament.update({ where: { id: tournamentId }, data: { prizeStatus: 'UNCONFIRMED' } });
			return { reserved: false, prizeStatus: 'UNCONFIRMED' as const, ...wallet };
		}

		const newBalance = organizer.balance - tournament.prizePool;
		await db.user.update({
			where: { id: organizerId },
			data: { balance: newBalance, totalSpent: { increment: tournament.prizePool } }
		});
		await db.transaction.create({
			data: {
				userId: organizerId,
				amount: -tournament.prizePool,
				balance: newBalance,
				description: `Эскроу призового фонда: ${tournament.title}`,
				type: TransactionType.SPENT,
				metadata: { tournamentId, kind: 'prize_escrow', idempotencyKey: idemKey }
			}
		});
		await db.prizeAllocation.deleteMany({ where: { tournamentId } });
		for (const split of splits) {
			await db.prizeAllocation.create({
				data: { tournamentId, place: split.place, amount: split.amount, status: 'RESERVED' }
			});
		}
		await db.tournament.update({ where: { id: tournamentId }, data: { prizeStatus: 'CONFIRMED' } });
		return {
			reserved: true,
			prizeStatus: 'CONFIRMED' as const,
			...describeEscrowWallet({ prizePool: tournament.prizePool, balance: newBalance })
		};
	});
}

export async function releasePrizeEscrow(tournamentId: string, actorId: string) {
	return prisma.$transaction(async (db) => {
		await lockTournamentRow(db, tournamentId);

		const tournament = await db.tournament.findUnique({
			where: { id: tournamentId },
			select: { id: true, title: true, prizePool: true, prizeStatus: true, createdById: true }
		});
		if (!tournament) throw new DomainError('Турнир не найден', 404);
		if (tournament.prizeStatus !== 'CONFIRMED' || tournament.prizePool <= 0 || !tournament.createdById) {
			return { released: false, prizeStatus: tournament.prizeStatus };
		}

		const releaseKey = `prize_escrow_release:${tournamentId}`;
		if (await hasIdempotencyKey(db, tournament.createdById, releaseKey)) {
			return { released: true, prizeStatus: 'NONE' as const };
		}

		const paid = await db.prizeAllocation.count({
			where: { tournamentId, status: 'PAID', amount: { gt: 0 } }
		});
		if (paid > 0) {
			throw new DomainError('Приз уже выплачен — эскроу не возвращаем', 400);
		}
		await lockUserBalanceRow(db, tournament.createdById);
		const organizer = await db.user.findUnique({ where: { id: tournament.createdById }, select: { balance: true } });
		if (!organizer) throw new DomainError('Организатор не найден', 404);
		const newBalance = organizer.balance + tournament.prizePool;
		await db.user.update({
			where: { id: tournament.createdById },
			data: { balance: newBalance, totalSpent: { decrement: tournament.prizePool } }
		});
		await db.transaction.create({
			data: {
				userId: tournament.createdById,
				amount: tournament.prizePool,
				balance: newBalance,
				description: `Возврат эскроу: ${tournament.title}`,
				type: TransactionType.REFUND,
				metadata: { tournamentId, kind: 'prize_escrow_release', idempotencyKey: releaseKey }
			}
		});
		await db.prizeAllocation.updateMany({
			where: { tournamentId, status: 'RESERVED' },
			data: { status: 'PENDING' }
		});
		await db.tournament.update({ where: { id: tournamentId }, data: { prizeStatus: 'NONE' } });
		await db.auditLog.create({
			data: {
				actorId,
				action: 'PRIZE_ESCROW_RELEASED',
				entity: 'Tournament',
				entityId: tournamentId,
				payload: { amount: tournament.prizePool }
			}
		});
		return { released: true, prizeStatus: 'NONE' as const };
	});
}
