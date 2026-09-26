import { NextRequest, NextResponse } from 'next/server';
import { getCurrentSteamUser } from '@/server/auth/session';
import { respondReadiness } from '@/server/tournaments/readiness';
import { publishTournamentEvent } from '@/server/realtime/publish';
import { toErrorResponse, DomainError } from '@/server/errors';
import { assertSameOriginMutation, readIdempotencyKey } from '@/server/http/mutation-guards';
import { assertRateLimit } from '@/server/rate-limit';
import { getCachedJson, setCachedJson } from '@/server/cache/redis';
import { z } from 'zod';

const schema = z.object({
	teamId: z.string().min(1),
	ready: z.boolean()
});

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
	const { id: tournamentId } = await params;
	try {
		assertSameOriginMutation(req);
		const user = await getCurrentSteamUser();
		if (!user) return NextResponse.json({ error: 'Войдите через Steam' }, { status: 401 });
		await assertRateLimit(`tournament-ready:${user.id}`, 40, 600);
		const idemKey = readIdempotencyKey(req);
		const parsed = schema.safeParse(await req.json());
		if (!parsed.success) return NextResponse.json({ error: 'Нужны teamId и ready' }, { status: 400 });
		const cacheKey = idemKey
			? `tournament-ready-idem:${user.id}:${tournamentId}:${parsed.data.teamId}:${parsed.data.ready}:${idemKey}`
			: null;
		if (cacheKey) {
			const cached = await getCachedJson<unknown>(cacheKey);
			if (cached) return NextResponse.json(cached);
		}
		const application = await respondReadiness(tournamentId, parsed.data.teamId, user.id, parsed.data.ready);
		await publishTournamentEvent(tournamentId, 'ready_updated', {
			teamId: parsed.data.teamId,
			ready: parsed.data.ready
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
