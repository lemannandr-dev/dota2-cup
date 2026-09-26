import { z } from 'zod';
import { getCurrentSteamUser } from '@/server/auth/session';
import { managePartyMember } from '@/server/party/service';
import { assertPartyOrigin, partyError } from '@/server/party/request';

const schema = z.object({
	action: z.enum(['leave', 'kick', 'substitute', 'deputy']),
	userId: z.string().min(1).max(100).optional(), isSubstitute: z.boolean().optional()
}).strict();

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
	const user = await getCurrentSteamUser();
	if (!user) return Response.json({ error: 'Войдите через Steam.' }, { status: 401 });
	try {
		assertPartyOrigin(req);
		const parsed = schema.safeParse(await req.json().catch(() => null));
		if (!parsed.success) return Response.json({ error: 'Неверные данные.' }, { status: 400 });
		return Response.json(await managePartyMember((await params).id, user.id, parsed.data));
	} catch (error) { return partyError(error); }
}
