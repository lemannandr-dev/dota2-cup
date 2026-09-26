import { getCurrentSteamUser } from '@/server/auth/session';
import { answerPartyInvitation, getPartyInvitation } from '@/server/party/service';
import { assertPartyOrigin, partyError } from '@/server/party/request';

type Context = { params: Promise<{ token: string }> };
export async function GET(_: Request, { params }: Context) {
	const user = await getCurrentSteamUser();
	if (!user) return Response.json({ error: 'Войдите через Steam.' }, { status: 401 });
	const { token } = await params;
	if (!/^[a-f0-9]{64}$/.test(token)) return Response.json({ error: 'Неверная ссылка.' }, { status: 404 });
	try {
		return Response.json({ invite: await getPartyInvitation({ token }, user.id) }, { headers: { 'Cache-Control': 'no-store', 'Referrer-Policy': 'no-referrer' } });
	} catch (error) { return partyError(error); }
}

export async function POST(req: Request, { params }: Context) {
	const user = await getCurrentSteamUser();
	if (!user) return Response.json({ error: 'Войдите через Steam.' }, { status: 401 });
	const { token } = await params;
	if (!/^[a-f0-9]{64}$/.test(token)) return Response.json({ error: 'Неверная ссылка.' }, { status: 404 });
	try {
		assertPartyOrigin(req);
		return Response.json({ invite: await answerPartyInvitation({ token }, user.id, 'ACCEPTED') });
	} catch (error) { return partyError(error); }
}
