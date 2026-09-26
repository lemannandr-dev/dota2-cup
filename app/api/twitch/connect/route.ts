import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { getCurrentSteamUser } from '@/server/auth/session';
import { parseTwitchLogin } from '@/lib/twitch';
import { lookupTwitchUser } from '@/server/twitch/helix';

const schema = z.object({
	twitchChannel: z.string().trim().min(1).max(64)
});

export async function POST(req: NextRequest) {
	const user = await getCurrentSteamUser();
	if (!user) return NextResponse.json({ error: 'Войдите через Steam' }, { status: 401 });
	const parsed = schema.safeParse(await req.json());
	if (!parsed.success) return NextResponse.json({ error: 'Укажите канал Twitch' }, { status: 400 });
	const login = parseTwitchLogin(parsed.data.twitchChannel);
	if (!login) return NextResponse.json({ error: 'Некорректный логин канала' }, { status: 400 });

	const channel = await lookupTwitchUser(login);
	if (!channel) return NextResponse.json({ error: 'Канал Twitch не найден' }, { status: 404 });

	await prisma.user.update({
		where: { id: user.id },
		data: { twitchChannel: channel.login, isStreamer: true }
	});

	return NextResponse.json({
		ok: true,
		channel: { login: channel.login, displayName: channel.displayName }
	});
}

export async function DELETE() {
	const user = await getCurrentSteamUser();
	if (!user) return NextResponse.json({ error: 'Войдите через Steam' }, { status: 401 });
	await prisma.user.update({
		where: { id: user.id },
		data: { twitchChannel: null, isStreamer: false }
	});
	return NextResponse.json({ ok: true });
}
