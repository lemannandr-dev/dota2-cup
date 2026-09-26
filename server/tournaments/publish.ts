import { prisma } from '@/lib/prisma';
import { DomainError } from '@/server/errors';
import { reservePrizePool, releasePrizeEscrow } from '@/server/prizes/escrow';
import { notifyCheckInOpened } from '@/server/tournaments/check-in-notify';
import { pickFinalMatch } from '@/lib/prize-places';

const allowedFrom: Record<string, string[]> = {
	DRAFT: ['REGISTRATION', 'CANCELLED'],
	REGISTRATION: ['CHECK_IN', 'CANCELLED'],
	CHECK_IN: ['REGISTRATION', 'LIVE', 'CANCELLED'],
	LIVE: ['FINISHED', 'CANCELLED'],
	FINISHED: [],
	CANCELLED: []
};

export async function publishTournament(tournamentId: string, actorId: string) {
	const tournament = await prisma.tournament.findUnique({ where: { id: tournamentId } });
	if (!tournament) throw new DomainError('Турнир не найден', 404);
	if (tournament.status !== 'DRAFT') throw new DomainError('Опубликовать можно только черновик', 400);
	if (tournament.format === 'DOUBLE_ELIMINATION') {
		// DE engine exists; keep publish unrestricted once format is chosen.
	}

	const escrow = tournament.createdById
		? await reservePrizePool(tournamentId, tournament.createdById)
		: { reserved: false, prizeStatus: tournament.prizeStatus };

	const updated = await prisma.tournament.update({
		where: { id: tournamentId },
		data: { status: 'REGISTRATION' }
	});
	await prisma.auditLog.create({
		data: {
			actorId,
			action: 'TOURNAMENT_PUBLISHED',
			entity: 'Tournament',
			entityId: tournamentId,
			payload: escrow
		}
	});
	return updated;
}

export async function transitionTournamentStatus(tournamentId: string, actorId: string, nextStatus: string) {
	const tournament = await prisma.tournament.findUnique({ where: { id: tournamentId } });
	if (!tournament) throw new DomainError('Турнир не найден', 404);
	const allowed = allowedFrom[tournament.status] ?? [];
	if (!allowed.includes(nextStatus)) {
		throw new DomainError(`Нельзя сменить ${tournament.status} → ${nextStatus}`, 400);
	}
	if (nextStatus === 'FINISHED') {
		const matches = await prisma.match.findMany({
			where: { tournamentId },
			select: { bracket: true, winnerTeamId: true, teamAId: true, teamBId: true, nextMatchId: true }
		});
		if (!pickFinalMatch(matches)?.winnerTeamId) {
			throw new DomainError('Завершить можно после финала с победителем', 400);
		}
	}
	if (nextStatus === 'CANCELLED') {
		await releasePrizeEscrow(tournamentId, actorId).catch((error) => {
			console.error('escrow release failed', tournamentId, error);
			throw error;
		});
	}
	const updated = await prisma.tournament.update({
		where: { id: tournamentId },
		data: { status: nextStatus as typeof tournament.status }
	});
	await prisma.auditLog.create({
		data: {
			actorId,
			action: 'TOURNAMENT_STATUS_CHANGED',
			entity: 'Tournament',
			entityId: tournamentId,
			payload: { from: tournament.status, to: nextStatus }
		}
	});
	if (nextStatus === 'CHECK_IN') {
		await notifyCheckInOpened([tournamentId]).catch((error) => {
			console.error('check-in notify failed', error);
		});
	}
	return updated;
}
