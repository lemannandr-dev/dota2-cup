import { NextRequest, NextResponse } from 'next/server';
import { getCurrentSteamUser } from '@/server/auth/session';
import { registerTeam } from '@/server/tournaments/register';
import { DomainError, toErrorResponse } from '@/server/errors';
import { assertSameOriginMutation, readIdempotencyKey } from '@/server/http/mutation-guards';
import { assertRateLimit } from '@/server/rate-limit';
import { getCachedJson, setCachedJson } from '@/server/cache/redis';
import { publishTournamentEvent } from '@/server/realtime/publish';
import { z } from 'zod';

const schema = z.object({ teamId: z.string().min(1) });

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
	const { id: tournamentId } = await params;
	try {
		assertSameOriginMutation(req);
		const user = await getCurrentSteamUser();
		if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
		await assertRateLimit(`tournament-register:${user.id}`, 30, 600);
		const parsed = schema.safeParse(await req.json());
		if (!parsed.success) return NextResponse.json({ error: 'teamId required' }, { status: 400 });
		const idemKey = readIdempotencyKey(req);
		const cacheKey = idemKey
			? `tournament-register-idem:${user.id}:${tournamentId}:${parsed.data.teamId}:${idemKey}`
			: null;
		if (cacheKey) {
			const cached = await getCachedJson<unknown>(cacheKey);
			if (cached) return NextResponse.json(cached);
		}
		const application = await registerTeam(tournamentId, parsed.data.teamId, user.id);
		await publishTournamentEvent(tournamentId, 'application_updated', {
			applicationId: application.id,
			teamId: parsed.data.teamId,
			status: application.status
		}).catch(() => undefined);
		const payload = { application };
		if (cacheKey) await setCachedJson(cacheKey, payload, 60 * 60);
		return NextResponse.json(payload, { status: 201 });
	} catch (error) {
		if (error instanceof DomainError) {
			return NextResponse.json({ error: error.message }, { status: error.status });
		}
		const mapped = toErrorResponse(error);
		return NextResponse.json({ error: mapped.error }, { status: mapped.status });
	}
}
