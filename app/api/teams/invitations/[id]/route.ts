import { z } from 'zod';
import { getCurrentSteamUser } from '@/server/auth/session';
import { answerPartyInvitation, getPartyInvitation } from '@/server/party/service';
import { assertPartyOrigin, partyError } from '@/server/party/request';

type Context = { params: Promise<{ id: string }> };

export async function GET(_: Request, { params }: Context) {
	const user = await getCurrentSteamUser();
	if (!user) return Response.json({ error: 'Войдите через Steam.' }, { status: 401 });
	try {
		return Response.json({ invite: await getPartyInvitation({ inviteId: (await params).id }, user.id) }, { headers: { 'Cache-Control': 'no-store' } });
	} catch (error) { return partyError(error); }
}

export async function PATCH(req: Request, { params }: Context) {
	const user = await getCurrentSteamUser();
	if (!user) return Response.json({ error: 'Войдите через Steam.' }, { status: 401 });
	try {
		assertPartyOrigin(req);
		const parsed = z.object({ action: z.enum(['ACCEPTED', 'DECLINED']) }).strict().safeParse(await req.json().catch(() => null));
		if (!parsed.success) return Response.json({ error: 'Неверный ответ на приглашение.' }, { status: 400 });
		return Response.json({ invite: await answerPartyInvitation({ inviteId: (await params).id }, user.id, parsed.data.action) }, { headers: { 'Cache-Control': 'no-store' } });
	} catch (error) { return partyError(error); }
}
