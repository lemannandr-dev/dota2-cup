import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { getCurrentSteamUser } from '@/server/auth/session';
import { isTournamentStaff } from '@/server/tournaments/staff';
import { parseTwitchLogin, withStreamRule } from '@/lib/twitch';
import { broadcastFromInput } from '@/lib/broadcast';
import { lookupTwitchUser } from '@/server/twitch/helix';

const schema = z.object({ twitchChannel: z.string().trim().min(1).max(64) });

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
	const { id } = await params;
	const user = await getCurrentSteamUser();
	if (!user) return NextResponse.json({ error: 'Войдите через Steam' }, { status: 401 });
	if (!(await isTournamentStaff(user.id, user.role, id))) {
		return NextResponse.json({ error: 'Только организатор' }, { status: 403 });
	}
	const parsed = schema.safeParse(await req.json());
	if (!parsed.success) return NextResponse.json({ error: 'Укажите канал' }, { status: 400 });
	const login = parseTwitchLogin(parsed.data.twitchChannel);
	if (!login) return NextResponse.json({ error: 'Некорректный канал Twitch' }, { status: 400 });
	const channel = await lookupTwitchUser(login);
	if (!channel) return NextResponse.json({ error: 'Канал Twitch не найден' }, { status: 404 });
	const tournament = await prisma.tournament.findUnique({ where: { id }, select: { rules: true, broadcast: true } });
	if (!tournament) return NextResponse.json({ error: 'Турнир не найден' }, { status: 404 });
	await prisma.tournament.update({
		where: { id },
		data: {
			rules: withStreamRule(tournament.rules ?? undefined, channel.login),
			broadcast: broadcastFromInput({ twitchChannel: channel.login, previous: tournament.broadcast })
		}
	});
	return NextResponse.json({ ok: true, channel: { login: channel.login } });
}
