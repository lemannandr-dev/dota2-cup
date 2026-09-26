import { prisma } from '@/lib/prisma';
import { DomainError } from '@/server/errors';
import { shouldResetOrphanPrize } from '@/lib/tournament-owner';
import { ensureOwnerStaff } from '@/server/tournaments/staff';

async function hasPrizeEscrowTx(tournamentId: string, title: string) {
	const row = await prisma.transaction.findFirst({
		where: {
			type: 'SPENT',
			OR: [
				{ description: `Эскроу призового фонда: ${title}` },
				{
					AND: [
						{ metadata: { path: ['kind'], equals: 'prize_escrow' } },
						{ metadata: { path: ['tournamentId'], equals: tournamentId } }
					]
				}
			]
		},
		select: { id: true }
	});
	return Boolean(row);
}

export async function claimOrphanTournament(tournamentId: string, userId: string) {
	const tournament = await prisma.tournament.findUnique({
		where: { id: tournamentId },
		select: { id: true, title: true, createdById: true, prizeStatus: true }
	});
	if (!tournament) throw new DomainError('Турнир не найден', 404);
	if (tournament.createdById && tournament.createdById !== userId) {
		throw new DomainError('У кубка уже есть организатор', 409);
	}

	const hasEscrowTx = await hasPrizeEscrowTx(tournamentId, tournament.title);
	const resetPrize = shouldResetOrphanPrize({
		hadOwner: Boolean(tournament.createdById),
		prizeStatus: tournament.prizeStatus,
		hasEscrowTx
	});

	await prisma.tournament.update({
		where: { id: tournamentId },
		data: {
			createdById: userId,
			...(resetPrize ? { prizeStatus: 'UNCONFIRMED' } : {})
		}
	});
	try {
		await ensureOwnerStaff(tournamentId, userId, 'OWNER');
	} catch {
		/* staff table may not exist until migrate; owner is still createdById */
	}
	try {
		await prisma.auditLog.create({
			data: {
				actorId: userId,
				action: 'TOURNAMENT_OWNER_CLAIMED',
				entity: 'Tournament',
				entityId: tournamentId,
				payload: { resetPrize, previousOwner: tournament.createdById }
			}
		});
	} catch {
		/* audit is optional */
	}
	return { tournamentId, resetPrize, prizeStatus: resetPrize ? 'UNCONFIRMED' : tournament.prizeStatus };
}
