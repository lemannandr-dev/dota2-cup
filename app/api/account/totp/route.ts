import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCurrentSteamUser } from '@/server/auth/session';
import { generateTotpSecret, totpAuthUrl, verifyTotp } from '@/lib/totp';

export async function GET() {
	const user = await getCurrentSteamUser();
	if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
	const row = await prisma.user.findUnique({
		where: { id: user.id },
		select: { totpEnabledAt: true }
	});
	return NextResponse.json({ enabled: Boolean(row?.totpEnabledAt) });
}

export async function POST(req: NextRequest) {
	const user = await getCurrentSteamUser();
	if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
	const body = (await req.json().catch(() => ({}))) as { action?: string; secret?: string; code?: string };
	const row = await prisma.user.findUnique({
		where: { id: user.id },
		select: { totpSecret: true, totpEnabledAt: true, displayName: true }
	});
	if (!row) return NextResponse.json({ error: 'Пользователь не найден' }, { status: 404 });

	if (body.action === 'start') {
		const secret = generateTotpSecret();
		return NextResponse.json({
			secret,
			otpauth: totpAuthUrl(secret, row.displayName)
		});
	}

	if (body.action === 'enable') {
		if (!body.secret || !verifyTotp(body.secret, body.code ?? '')) {
			return NextResponse.json({ error: 'Неверный код приложения' }, { status: 400 });
		}
		await prisma.user.update({
			where: { id: user.id },
			data: { totpSecret: body.secret, totpEnabledAt: new Date() }
		});
		return NextResponse.json({ enabled: true });
	}

	if (body.action === 'disable') {
		if (!row.totpSecret || !row.totpEnabledAt) {
			return NextResponse.json({ enabled: false });
		}
		if (!verifyTotp(row.totpSecret, body.code ?? '')) {
			return NextResponse.json({ error: 'Неверный код приложения' }, { status: 400 });
		}
		await prisma.user.update({
			where: { id: user.id },
			data: { totpSecret: null, totpEnabledAt: null }
		});
		return NextResponse.json({ enabled: false });
	}

	return NextResponse.json({ error: 'Неизвестное действие' }, { status: 400 });
}
