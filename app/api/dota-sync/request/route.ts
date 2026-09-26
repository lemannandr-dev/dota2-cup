import { NextResponse } from 'next/server';
import { createHash, randomBytes } from 'crypto';
import { prisma } from '@/lib/prisma';
import { getCurrentSteamUser } from '@/server/auth/session';

const CODE_TTL_MS = 5 * 60 * 1000;

export async function POST() {
	const user = await getCurrentSteamUser();
	if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

	await prisma.dotaSyncRequest.deleteMany({ where: { userId: user.id, usedAt: null } });
	const code = randomBytes(18).toString('base64url');
	const expiresAt = new Date(Date.now() + CODE_TTL_MS);
	await prisma.dotaSyncRequest.create({
		data: {
			userId: user.id,
			tokenHash: createHash('sha256').update(code).digest('hex'),
			expiresAt
		}
	});

	return NextResponse.json({ code, expiresAt: expiresAt.toISOString() });
}