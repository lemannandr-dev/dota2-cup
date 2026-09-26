import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCurrentSteamUser } from '@/server/auth/session';

type SnapshotPayload = {
	steamDetected?: boolean;
	dotaDetected?: boolean;
	helperVersion?: string;
	cacheFound?: boolean;
	cacheFileName?: string | null;
	plusSubscriber?: boolean;
	plusStatus?: number | null;
	challengeCount?: number;
	heroProgressPresent?: boolean;
	cacheOwnerMatched?: boolean;
};

export async function GET() {
	const user = await getCurrentSteamUser();
	if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

	const [snapshot, officialHeroCount, pending] = await Promise.all([
		prisma.dotaClientSnapshot.findFirst({
			where: { userId: user.id },
			orderBy: { createdAt: 'desc' },
			select: { createdAt: true, payload: true }
		}),
		prisma.dotaHeroProgress.count({ where: { userId: user.id } }),
		prisma.dotaSyncRequest.findFirst({
			where: { userId: user.id, usedAt: null, expiresAt: { gt: new Date() } },
			orderBy: { createdAt: 'desc' },
			select: { expiresAt: true }
		})
	]);

	const payload = (snapshot?.payload ?? {}) as SnapshotPayload;

	return NextResponse.json({
		lastSyncedAt: snapshot?.createdAt.toISOString() ?? null,
		officialHeroCount,
		steamDetected: payload.steamDetected ?? null,
		dotaDetected: payload.dotaDetected ?? null,
		helperVersion: payload.helperVersion ?? null,
		cacheFound: payload.cacheFound ?? null,
		cacheFileName: payload.cacheFileName ?? null,
		plusSubscriber: payload.plusSubscriber ?? null,
		challengeCount: payload.challengeCount ?? null,
		heroProgressPresent: payload.heroProgressPresent ?? null,
		cacheOwnerMatched: payload.cacheOwnerMatched ?? null,
		pendingExpiresAt: pending?.expiresAt.toISOString() ?? null
	});
}
