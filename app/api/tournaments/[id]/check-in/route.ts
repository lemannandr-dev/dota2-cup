import { NextRequest, NextResponse } from 'next/server';
import { getCurrentSteamUser } from '@/server/auth/session';
import { checkInTeam } from '@/server/tournaments/check-in';
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
		await assertRateLimit(`tournament-checkin:${user.id}`, 40, 600);
		const parsed = schema.safeParse(await req.json());
		if (!parsed.success) return NextResponse.json({ error: 'teamId required' }, { status: 400 });
		const idemKey = readIdempotencyKey(req);
		const cacheKey = idemKey
			? `tournament-checkin-idem:${user.id}:${tournamentId}:${parsed.data.teamId}:${idemKey}`
			: null;
		if (cacheKey) {
			const cached = await getCachedJson<unknown>(cacheKey);
			if (cached) return NextResponse.json(cached);
		}
		const application = await checkInTeam(tournamentId, parsed.data.teamId, user.id);
		await publishTournamentEvent(tournamentId, 'application_updated', {
			applicationId: application.id,
			teamId: parsed.data.teamId,
			status: application.status
		}).catch(() => undefined);
		const payload = { application };
		if (cacheKey) await setCachedJson(cacheKey, payload, 60 * 60);
		return NextResponse.json(payload);
	} catch (error) {
		if (error instanceof DomainError) {
			return NextResponse.json({ error: error.message }, { status: error.status });
		}
		const mapped = toErrorResponse(error);
		return NextResponse.json({ error: mapped.error }, { status: mapped.status });
	}
}
