import { getCurrentSteamUser } from '@/server/auth/session';
import { getParty } from '@/server/party/service';
import { partyError } from '@/server/party/request';

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
	const user = await getCurrentSteamUser();
	if (!user) return Response.json({ error: 'Войдите через Steam.' }, { status: 401 });
	try {
		return Response.json({ party: await getParty((await params).id, user.id) }, { headers: { 'Cache-Control': 'no-store' } });
	} catch (error) { return partyError(error); }
}
