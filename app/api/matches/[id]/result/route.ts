import { NextRequest, NextResponse } from 'next/server';
import { getCurrentSteamUser } from '@/server/auth/session';
import { forceMatchResult } from '@/server/matches/report';
import { isTournamentReferee } from '@/server/tournaments/staff';
import { prisma } from '@/lib/prisma';
import { toErrorResponse, DomainError } from '@/server/errors';
import { assertSameOriginMutation } from '@/server/http/mutation-guards';
import { assertRateLimit } from '@/server/rate-limit';
import { z } from 'zod';

const schema = z
	.object({
		scoreA: z.number().int().min(0).max(5).optional(),
		scoreB: z.number().int().min(0).max(5).optional(),
		technical: z.boolean().optional(),
		forfeit: z.enum(['A', 'B']).optional()
	})
	.refine((value) => Boolean(value.forfeit) || (typeof value.scoreA === 'number' && typeof value.scoreB === 'number'), {
		message: 'Нужен счёт или сторона неявки'
	});

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
	const { id: matchId } = await params;
	try {
		assertSameOriginMutation(req);
		const user = await getCurrentSteamUser();
		if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
		await assertRateLimit(`match-result:${user.id}`, 20, 600);
		const parsed = schema.safeParse(await req.json());
		if (!parsed.success) return NextResponse.json({ error: 'Некорректный счёт' }, { status: 400 });

		const match = await prisma.match.findUnique({ where: { id: matchId }, select: { tournamentId: true } });
		if (!match) return NextResponse.json({ error: 'Матч не найден' }, { status: 404 });
		if (!(await isTournamentReferee(user.id, user.role, match.tournamentId))) {
			return NextResponse.json({ error: 'Результат напрямую ставят только судья или администратор' }, { status: 403 });
		}

		const updated = await forceMatchResult(
			matchId,
			user.id,
			parsed.data.scoreA ?? 0,
			parsed.data.scoreB ?? 0,
			parsed.data.technical,
			parsed.data.forfeit
		);
		return NextResponse.json({ match: updated });
	} catch (error) {
		if (error instanceof DomainError) {
			return NextResponse.json({ error: error.message }, { status: error.status });
		}
		const mapped = toErrorResponse(error);
		return NextResponse.json({ error: mapped.error }, { status: mapped.status });
	}
}
