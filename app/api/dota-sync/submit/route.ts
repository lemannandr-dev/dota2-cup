import { NextRequest, NextResponse } from 'next/server';
import { createHash } from 'crypto';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { steam64ToAccountId } from '@/lib/steam';
import { shouldReplaceOfficialXp } from '@/lib/save-official-hero-progress';

const heroProgressSchema = z.object({
	heroId: z.number().int().positive().max(1000),
	level: z.number().int().min(0).max(30),
	xp: z.number().int().min(0).max(2_000_000),
	xpToNext: z.number().int().min(0).max(2_000_000).optional()
});

const snapshotSchema = z.object({
	code: z.string().min(20).max(128),
	steamPath: z.string().max(1024).optional(),
	dotaPath: z.string().max(1024).optional(),
	payload: z.object({
		helperVersion: z.string().max(32),
		detectedAt: z.string().datetime(),
		steamDetected: z.boolean(),
		dotaDetected: z.boolean(),
		cacheFound: z.boolean().optional(),
		cacheFileName: z.string().max(128).optional().nullable(),
		cacheAccountId: z.union([z.number(), z.string()]).optional().nullable(),
		plusStatus: z.union([z.number(), z.string()]).optional().nullable(),
		plusSubscriber: z.boolean().optional(),
		challengeCount: z.number().int().min(0).max(10_000).optional(),
		replaysScanned: z.number().int().min(0).max(100).optional(),
		matchesWithMetadata: z.number().int().min(0).max(100).optional(),
		heroProgressPresent: z.boolean().optional()
	}),
	heroes: z.array(heroProgressSchema).max(200).optional()
});

export async function POST(req: NextRequest) {
	const body = snapshotSchema.safeParse(await req.json().catch(() => null));
	if (!body.success) return NextResponse.json({ error: 'Invalid snapshot' }, { status: 400 });

	const input = body.data;
	const request = await prisma.dotaSyncRequest.findUnique({
		where: { tokenHash: createHash('sha256').update(input.code).digest('hex') }
	});
	if (!request || request.usedAt || request.expiresAt <= new Date()) {
		return NextResponse.json({ error: 'Invalid or expired sync code' }, { status: 401 });
	}

	const capturedAt = new Date();
	const user = await prisma.user.findUnique({ where: { id: request.userId }, select: { steamId: true } });
	const expectedAccountId = user?.steamId ? steam64ToAccountId(user.steamId) : null;
	const cacheAccountId = Number(input.payload.cacheAccountId);
	const plusStatus = Number(input.payload.plusStatus);
	const payload = {
		...input.payload,
		cacheAccountId: Number.isFinite(cacheAccountId) && cacheAccountId > 0 ? cacheAccountId : null,
		plusStatus: Number.isFinite(plusStatus) ? plusStatus : null,
		cacheOwnerMatched:
			expectedAccountId !== null && Number.isFinite(cacheAccountId) && cacheAccountId === expectedAccountId
	};
	await prisma.$transaction(async (tx) => {
		await tx.dotaSyncRequest.update({ where: { id: request.id }, data: { usedAt: new Date() } });
		await tx.dotaClientSnapshot.create({
			data: {
				userId: request.userId,
				steamPath: input.steamPath,
				dotaPath: input.dotaPath,
				payload
			}
		});
		for (const hero of input.heroes ?? []) {
			const existing = await tx.dotaHeroProgress.findUnique({
				where: { userId_heroId: { userId: request.userId, heroId: hero.heroId } }
			});
			if (!shouldReplaceOfficialXp(existing?.xp, hero.xp)) continue;
			await tx.dotaHeroProgress.upsert({
				where: { userId_heroId: { userId: request.userId, heroId: hero.heroId } },
				create: {
					userId: request.userId,
					heroId: hero.heroId,
					level: hero.level,
					xp: hero.xp,
					xpToNext: hero.xpToNext,
					source: 'CLIENT',
					capturedAt,
					payload: hero
				},
				update: {
					level: hero.level,
					xp: hero.xp,
					xpToNext: hero.xpToNext,
					source: 'CLIENT',
					capturedAt,
					payload: hero
				}
			});
		}
	});

	const officialHeroCount = await prisma.dotaHeroProgress.count({ where: { userId: request.userId } });
	return NextResponse.json({ ok: true, officialHeroCount });
}