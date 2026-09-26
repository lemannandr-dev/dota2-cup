import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCurrentSteamUser } from '@/server/auth/session';
import { createTournamentDraft } from '@/server/tournaments/create';
import { toErrorResponse } from '@/server/errors';
import { z } from 'zod';

export async function GET(req: NextRequest) {
	const user = await getCurrentSteamUser();
	const { searchParams } = new URL(req.url);
	const status = searchParams.get('status');
	const publishedOrOwn = user
		? [{ status: { not: 'DRAFT' as const } }, { createdById: user.id }]
		: [{ status: { not: 'DRAFT' as const } }];
	const tournaments = await prisma.tournament.findMany({
		where: {
			scrimBoard: false,
			...(status ? { status: status as never } : {}),
			OR: publishedOrOwn
		},
		orderBy: { startAt: 'asc' },
		take: 100,
		include: { _count: { select: { applications: true } } }
	});
	return NextResponse.json({ tournaments });
}

const createSchema = z.object({
	title: z.string().min(3).max(100),
	description: z.string().max(2000).optional(),
	format: z.enum(['SINGLE_ELIMINATION', 'DOUBLE_ELIMINATION']).default('SINGLE_ELIMINATION'),
	maxTeams: z.union([z.literal(8), z.literal(16), z.literal(32)]).default(8),
	seriesRules: z.string().max(50).default('BO1'),
	region: z.string().max(50).optional(),
	rankCap: z.string().max(50).optional(),
	prizePool: z.number().int().min(0).default(0),
	startAt: z.string().datetime(),
	checkInOpensAt: z.string().datetime().optional(),
	checkInClosesAt: z.string().datetime().optional(),
	rules: z.string().max(10000).optional(),
	twitchChannel: z.string().max(120).optional(),
	twitchSecondary: z.string().max(120).optional(),
	youtubeUrl: z.string().url().max(500).optional(),
	youtubeSecondaryUrl: z.string().url().max(500).optional(),
	dotaTv: z.string().max(32).optional(),
	lobbyName: z.string().max(80).optional(),
	delaySec: z.number().int().min(0).max(600).optional(),
	overlayTitle: z.string().max(80).optional(),
	aegisAward: z.enum(['ember', 'night', 'void', 'relic']).optional(),
	inviteOnly: z.boolean().optional()
});

export async function POST(req: NextRequest) {
	try {
		const { assertSameOriginMutation } = await import('@/server/http/mutation-guards');
		const { assertRateLimit } = await import('@/server/rate-limit');
		assertSameOriginMutation(req);
		const user = await getCurrentSteamUser();
		if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
		await assertRateLimit(`tournament-create:${user.id}`, 10, 600);

		const parsed = createSchema.safeParse(await req.json());
		if (!parsed.success) {
			return NextResponse.json({ error: 'Validation failed', issues: parsed.error.issues }, { status: 400 });
		}
		const d = parsed.data;
		const tournament = await createTournamentDraft(user.id, user.role, {
			...d,
			startAt: new Date(d.startAt),
			checkInOpensAt: d.checkInOpensAt ? new Date(d.checkInOpensAt) : null,
			checkInClosesAt: d.checkInClosesAt ? new Date(d.checkInClosesAt) : null
		});
		return NextResponse.json({ tournament }, { status: 201 });
	} catch (error) {
		const { DomainError } = await import('@/server/errors');
		if (error instanceof DomainError) {
			return NextResponse.json({ error: error.message }, { status: error.status });
		}
		const mapped = toErrorResponse(error);
		return NextResponse.json({ error: mapped.error }, { status: mapped.status });
	}
}
