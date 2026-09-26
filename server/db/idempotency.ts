import type { Prisma } from '@prisma/client';

type Tx = Prisma.TransactionClient;

export function escrowIdempotencyKey(tournamentId: string) {
	return `prize_escrow:${tournamentId}`;
}

export function payoutIdempotencyKey(tournamentId: string, place: number) {
	return `prize_pay:${tournamentId}:${place}`;
}

export async function hasIdempotencyKey(db: Tx, userId: string, idempotencyKey: string) {
	const row = await db.transaction.findFirst({
		where: {
			userId,
			metadata: { path: ['idempotencyKey'], equals: idempotencyKey }
		},
		select: { id: true }
	});
	return Boolean(row);
}
