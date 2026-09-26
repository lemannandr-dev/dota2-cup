import { getCurrentSteamUser } from '@/server/auth/session';
import { createPartyLink, revokePartyLinks } from '@/server/party/service';
import { assertPartyOrigin, partyError } from '@/server/party/request';
import { assertRateLimit } from '@/server/rate-limit';
import { z } from 'zod';

export async function POST(req: Request) {
	const user = await getCurrentSteamUser();
	if (!user) return Response.json({ error: 'Войдите через Steam.' }, { status: 401 });
	try {
		assertPartyOrigin(req);
		const parsed = z.object({ teamId: z.string().min(1).max(100).optional(), tournamentId: z.string().min(1).max(100).optional() }).strict().safeParse(await req.json().catch(() => null));
		if (!parsed.success) return Response.json({ error: 'Неверные данные.' }, { status: 400 });
		await assertRateLimit(`party-link:${user.id}`, 20, 600);
		return Response.json(await createPartyLink(user.id, parsed.data), { status: 201, headers: { 'Cache-Control': 'no-store' } });
	} catch (error) { return partyError(error); }
}

export async function DELETE(req: Request) {
	const user = await getCurrentSteamUser();
	if (!user) return Response.json({ error: 'Войдите через Steam.' }, { status: 401 });
	try {
		assertPartyOrigin(req);
		const parsed = z.object({ teamId: z.string().min(1).max(100) }).strict().safeParse(await req.json().catch(() => null));
		if (!parsed.success) return Response.json({ error: 'Укажите пати.' }, { status: 400 });
		await revokePartyLinks(parsed.data.teamId, user.id);
		return Response.json({ ok: true });
	} catch (error) { return partyError(error); }
}
