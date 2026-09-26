import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getCurrentSteamUser } from '@/lib/steam-session';
import { isSameOriginAppearanceRequest } from '@/server/appearance-request';
import { toErrorResponse } from '@/server/errors';
import { listLobbyMessages, lobbyTicketFor, postLobbyMessage } from '@/server/lobby/chat';
import { assertRateLimit } from '@/server/rate-limit';

export const dynamic = 'force-dynamic';

export async function GET() {
	const user = await getCurrentSteamUser();
	if (!user?.steamId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
	const messages = await listLobbyMessages();
	return NextResponse.json({
		messages,
		ticket: lobbyTicketFor(user)
	});
}

const bodySchema = z.object({ text: z.string().max(400) });

export async function POST(request: Request) {
	const user = await getCurrentSteamUser();
	if (!user?.steamId || !isSameOriginAppearanceRequest(request)) {
		return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
	}
	try {
		await assertRateLimit(`lobby-chat:${user.id}`, 8, 30);
		const parsed = bodySchema.safeParse(await request.json());
		if (!parsed.success) return NextResponse.json({ error: 'Некорректное сообщение' }, { status: 400 });
		const message = await postLobbyMessage(user.id, parsed.data.text);
		return NextResponse.json({ message });
	} catch (error) {
		const mapped = toErrorResponse(error);
		return NextResponse.json({ error: mapped.error }, { status: mapped.status });
	}
}
