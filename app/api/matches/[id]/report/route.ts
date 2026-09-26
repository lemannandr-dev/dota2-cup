import { NextRequest, NextResponse } from 'next/server';
import { getCurrentSteamUser } from '@/server/auth/session';
import { submitCaptainReport } from '@/server/matches/report';
import { toErrorResponse, DomainError } from '@/server/errors';
import { assertSameOriginMutation, readIdempotencyKey } from '@/server/http/mutation-guards';
import { assertRateLimit } from '@/server/rate-limit';
import { getCachedJson, setCachedJson } from '@/server/cache/redis';
import { z } from 'zod';

const schema = z.object({
	scoreA: z.number().int().min(0).max(5),
	scoreB: z.number().int().min(0).max(5),
	dotaMatchIds: z.array(z.string().min(3).max(32)).max(7).optional()
});

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
	const { id: matchId } = await params;
	try {
		assertSameOriginMutation(req);
		const user = await getCurrentSteamUser();
		if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
		await assertRateLimit(`match-report:${user.id}`, 30, 600);
		const idemKey = readIdempotencyKey(req);
		const cacheKey = idemKey ? `match-report-idem:${user.id}:${matchId}:${idemKey}` : null;
		if (cacheKey) {
			const cached = await getCachedJson<unknown>(cacheKey);
			if (cached) return NextResponse.json(cached);
		}
		const parsed = schema.safeParse(await req.json());
		if (!parsed.success) return NextResponse.json({ error: 'Некорректный счёт' }, { status: 400 });
		const result = await submitCaptainReport(matchId, user.id, parsed.data.scoreA, parsed.data.scoreB, parsed.data.dotaMatchIds ?? []);
		if (cacheKey) await setCachedJson(cacheKey, result, 60 * 60 * 24);
		return NextResponse.json(result);
	} catch (error) {
		if (error instanceof DomainError) {
			return NextResponse.json({ error: error.message }, { status: error.status });
		}
		const mapped = toErrorResponse(error);
		return NextResponse.json({ error: mapped.error }, { status: mapped.status });
	}
}
