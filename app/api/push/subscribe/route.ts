import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getCurrentSteamUser } from '@/server/auth/session';
import { prisma } from '@/lib/prisma';
import { DomainError, toErrorResponse } from '@/server/errors';
import { assertSameOriginMutation } from '@/server/http/mutation-guards';
import { assertRateLimit } from '@/server/rate-limit';
import { vapidPublicKey, webPushConfigured } from '@/lib/web-push-config';

export async function GET() {
	const user = await getCurrentSteamUser();
	if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
	const count = await prisma.pushSubscription.count({ where: { userId: user.id } }).catch(() => 0);
	return NextResponse.json({
		configured: webPushConfigured(),
		publicKey: vapidPublicKey() || null,
		subscriptions: count
	});
}

const schema = z.object({
	endpoint: z.string().url().max(2000),
	keys: z.object({
		p256dh: z.string().min(20).max(500),
		auth: z.string().min(8).max(200)
	})
});

export async function POST(req: NextRequest) {
	try {
		assertSameOriginMutation(req);
		const user = await getCurrentSteamUser();
		if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
		await assertRateLimit(`push-sub:${user.id}`, 20, 600);
		if (!webPushConfigured()) {
			return NextResponse.json({ error: 'Web Push не настроен (нет VAPID ключей)' }, { status: 503 });
		}
		const parsed = schema.safeParse(await req.json());
		if (!parsed.success) return NextResponse.json({ error: 'Некорректная подписка' }, { status: 400 });
		const row = await prisma.pushSubscription.upsert({
			where: { endpoint: parsed.data.endpoint },
			create: {
				userId: user.id,
				endpoint: parsed.data.endpoint,
				p256dh: parsed.data.keys.p256dh,
				auth: parsed.data.keys.auth,
				userAgent: req.headers.get('user-agent')?.slice(0, 300) ?? null
			},
			update: {
				userId: user.id,
				p256dh: parsed.data.keys.p256dh,
				auth: parsed.data.keys.auth,
				userAgent: req.headers.get('user-agent')?.slice(0, 300) ?? null
			}
		});
		return NextResponse.json({ id: row.id }, { status: 201 });
	} catch (error) {
		if (error instanceof DomainError) {
			return NextResponse.json({ error: error.message }, { status: error.status });
		}
		const mapped = toErrorResponse(error);
		return NextResponse.json({ error: mapped.error }, { status: mapped.status });
	}
}

export async function DELETE(req: NextRequest) {
	try {
		assertSameOriginMutation(req);
		const user = await getCurrentSteamUser();
		if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
		const body = (await req.json().catch(() => ({}))) as { endpoint?: string };
		if (!body.endpoint) {
			await prisma.pushSubscription.deleteMany({ where: { userId: user.id } });
			return NextResponse.json({ ok: true });
		}
		await prisma.pushSubscription.deleteMany({ where: { userId: user.id, endpoint: body.endpoint } });
		return NextResponse.json({ ok: true });
	} catch (error) {
		const mapped = toErrorResponse(error);
		return NextResponse.json({ error: mapped.error }, { status: mapped.status });
	}
}
