import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getCurrentSteamUser } from '@/server/auth/session';
import { saveMatchLobby } from '@/server/matches/lobby';
import { toErrorResponse, DomainError } from '@/server/errors';
import { assertSameOriginMutation } from '@/server/http/mutation-guards';
import { assertRateLimit } from '@/server/rate-limit';

const schema = z.object({
	name: z.string().trim().min(2).max(40),
	password: z.string().max(32).optional().nullable(),
	region: z.string().max(40).optional().nullable(),
	voiceUrl: z.string().max(300).optional().nullable(),
	playing: z.boolean().optional()
});

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
	const { id: matchId } = await params;
	try {
		assertSameOriginMutation(req);
		const user = await getCurrentSteamUser();
		if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
		await assertRateLimit(`match-lobby:${user.id}`, 40, 600);
		const parsed = schema.safeParse(await req.json());
		if (!parsed.success) return NextResponse.json({ error: 'Укажите имя лобби' }, { status: 400 });
		const lobby = await saveMatchLobby(matchId, user.id, user.role, parsed.data);
		return NextResponse.json({ lobby });
	} catch (error) {
		if (error instanceof DomainError) {
			return NextResponse.json({ error: error.message }, { status: error.status });
		}
		const mapped = toErrorResponse(error);
		return NextResponse.json({ error: mapped.error }, { status: mapped.status });
	}
}
