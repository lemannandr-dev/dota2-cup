import { prisma } from '@/lib/prisma';

/** Single cluster-wide lock for tournament tick (pg_try_advisory_lock). */
export const TOURNAMENT_TICK_LOCK_KEY = 8347291;

export async function tryPgAdvisoryLock(key: number): Promise<boolean> {
	const rows = await prisma.$queryRaw<{ locked: boolean }[]>`
		SELECT pg_try_advisory_lock(${key}) AS locked
	`;
	return rows[0]?.locked === true;
}

export async function releasePgAdvisoryLock(key: number): Promise<void> {
	await prisma.$queryRaw`SELECT pg_advisory_unlock(${key})`;
}

/** Runs fn when lock acquired; returns null if another worker holds the lock. */
export async function withPgAdvisoryLock<T>(key: number, fn: () => Promise<T>): Promise<T | null> {
	const locked = await tryPgAdvisoryLock(key);
	if (!locked) return null;
	try {
		return await fn();
	} finally {
		await releasePgAdvisoryLock(key);
	}
}

export async function lockTournamentRow(db: { $executeRaw: typeof prisma.$executeRaw }, tournamentId: string) {
	await db.$executeRaw`SELECT id FROM "Tournament" WHERE id = ${tournamentId} FOR UPDATE`;
}

export async function lockMatchRow(db: { $executeRaw: typeof prisma.$executeRaw }, matchId: string) {
	await db.$executeRaw`SELECT id FROM "Match" WHERE id = ${matchId} FOR UPDATE`;
}

export async function lockUserBalanceRow(db: { $executeRaw: typeof prisma.$executeRaw }, userId: string) {
	await db.$executeRaw`SELECT id FROM "User" WHERE id = ${userId} FOR UPDATE`;
}
