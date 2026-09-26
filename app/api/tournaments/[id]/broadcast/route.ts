import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { getCurrentSteamUser } from '@/server/auth/session';
import { isTournamentStaff } from '@/server/tournaments/staff';
import { broadcastFromInput } from '@/lib/broadcast';
import { withStreamRule } from '@/lib/twitch';
import { loadTournamentBroadcast } from '@/server/tournaments/broadcast-view';

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
	const { id } = await params;
	const payload = await loadTournamentBroadcast(id);
	if (!payload) return NextResponse.json({ error: 'Турнир не найден' }, { status: 404 });
	return NextResponse.json(payload);
}

const schema = z.object({
	twitchChannel: z.string().max(120).optional(),
	twitchSecondary: z.string().max(120).optional(),
	youtubeUrl: z.string().max(500).optional(),
	youtubeSecondaryUrl: z.string().max(500).optional(),
	dotaTv: z.string().max(32).optional(),
	lobbyName: z.string().max(80).optional(),
	delaySec: z.number().int().min(0).max(600).optional(),
	overlayTitle: z.string().max(80).optional(),
	discordWebhook: z.string().max(2048).optional(),
	telegramChatId: z.string().max(32).optional(),
	highlights: z.union([z.string().max(4000), z.array(z.string().max(500)).max(12)]).optional()
});

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
	const { id } = await params;
	const user = await getCurrentSteamUser();
	if (!user) return NextResponse.json({ error: 'Войдите через Steam' }, { status: 401 });
	if (!(await isTournamentStaff(user.id, user.role, id))) {
		return NextResponse.json({ error: 'Только организатор' }, { status: 403 });
	}
	const parsed = schema.safeParse(await req.json());
	if (!parsed.success) return NextResponse.json({ error: 'Некорректные данные эфира' }, { status: 400 });
	const tournament = await prisma.tournament.findUnique({ where: { id }, select: { rules: true, broadcast: true } });
	if (!tournament) return NextResponse.json({ error: 'Турнир не найден' }, { status: 404 });
	const broadcast = broadcastFromInput({ ...parsed.data, previous: tournament.broadcast });
	if (parsed.data.youtubeUrl && !broadcast.youtubeUrl) {
		return NextResponse.json({ error: 'Нужна https-ссылка YouTube (watch / youtu.be / live)' }, { status: 400 });
	}
	await prisma.tournament.update({
		where: { id },
		data: {
			broadcast,
			rules: withStreamRule(tournament.rules ?? undefined, broadcast.twitch ?? undefined)
		}
	});
	return NextResponse.json({ ok: true, broadcast });
}
