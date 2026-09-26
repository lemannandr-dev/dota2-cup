import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCurrentSteamUser } from '@/lib/steam-session';

export async function GET() {
	const user = await getCurrentSteamUser();
	if (!user) return NextResponse.json({ notifications: [], unreadCount: 0 }, { status: 200 });

	const [notifications, unreadCount] = await Promise.all([
		prisma.notification.findMany({
			where: { userId: user.id },
			orderBy: { createdAt: 'desc' },
			take: 12
		}),
		prisma.notification.count({ where: { userId: user.id, readAt: null } })
	]);

	return NextResponse.json({ notifications, unreadCount }, { status: 200 });
}

export async function PATCH(req: NextRequest) {
	const user = await getCurrentSteamUser();
	if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

	const body = await req.json().catch(() => ({}));
	const id = typeof body.id === 'string' ? body.id : null;

	await prisma.notification.updateMany({
		where: { userId: user.id, ...(id ? { id } : {}), readAt: null },
		data: { readAt: new Date() }
	});

	return NextResponse.json({ ok: true }, { status: 200 });
}