import { z } from 'zod';
import { getCurrentSteamUser } from '@/server/auth/session';
import { createPartyInvite } from '@/server/party/service';
import { assertPartyOrigin, partyError } from '@/server/party/request';
import { assertRateLimit } from '@/server/rate-limit';

const inviteSchema = z.object({
	teamId: z.string().min(1).max(100).optional(),
	toUserId: z.string().min(1).max(100),
	tournamentId: z.string().min(1).max(100).optional(),
	position: z.number().int().min(1).max(5).optional(),
	role: z.literal('member').optional(),
	message: z.string().trim().max(500).optional()
}).strict();

export async function POST(req: Request) {
	const user = await getCurrentSteamUser();
	if (!user) return Response.json({ error: 'Войдите через Steam.' }, { status: 401 });
	try {
		assertPartyOrigin(req);
		const parsed = inviteSchema.safeParse(await req.json().catch(() => null));
		if (!parsed.success) return Response.json({ error: 'Неверные данные приглашения.' }, { status: 400 });
		await assertRateLimit(`party-invite:${user.id}`, 30, 600);
		return Response.json(await createPartyInvite(user.id, parsed.data), { status: 201, headers: { 'Cache-Control': 'no-store' } });
	} catch (error) { return partyError(error); }
}
