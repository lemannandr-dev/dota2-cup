import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { getCurrentSteamUser } from '@/server/auth/session';
import { isTournamentStaff } from '@/server/tournaments/staff';
import { canEditTournamentFields, nextPrizeStatusAfterPoolChange } from '@/lib/tournament-edit';

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
	const { id } = await params;
	const tournament = await prisma.tournament.findUnique({
		where: { id },
		include: {
			applications: { include: { team: { include: { members: true } } } },
			matches: {
				orderBy: [{ round: 'asc' }, { position: 'asc' }],
				include: {
					teamA: { select: { id: true, name: true, createdById: true } },
					teamB: { select: { id: true, name: true, createdById: true } },
					reports: { select: { teamId: true, scoreA: true, scoreB: true } }
				}
			},
			staff: { select: { userId: true, role: true } },
			prizeAllocations: true
		}
	});
	if (!tournament) return NextResponse.json({ error: 'Not found' }, { status: 404 });
	return NextResponse.json({ tournament });
}

const editSchema = z.object({
	title: z.string().min(2).max(120).optional(),
	description: z.string().max(4000).optional(),
	rules: z.string().max(8000).optional(),
	prizePoolRub: z.number().min(0).max(10_000_000).optional(),
	startAt: z.string().optional(),
	checkInOpensAt: z.string().nullable().optional(),
	checkInClosesAt: z.string().nullable().optional(),
	region: z.string().max(40).optional(),
	rankCap: z.string().max(40).optional(),
	seriesRules: z.string().max(16).optional(),
	maxTeams: z.number().int().min(2).max(128).optional(),
	aegisAward: z.enum(['ember', 'night', 'void', 'relic']).optional(),
	inviteOnly: z.boolean().optional()
});

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
	const { id } = await params;
	const user = await getCurrentSteamUser();
	if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
	if (!(await isTournamentStaff(user.id, user.role, id))) {
		return NextResponse.json({ error: 'Только организатор' }, { status: 403 });
	}
	const parsed = editSchema.safeParse(await req.json());
	if (!parsed.success) return NextResponse.json({ error: 'Проверьте поля черновика' }, { status: 400 });
	const current = await prisma.tournament.findUnique({
		where: { id },
		select: { id: true, status: true, prizePool: true, prizeStatus: true }
	});
	if (!current) return NextResponse.json({ error: 'Not found' }, { status: 404 });
	if (!canEditTournamentFields(current.status)) {
		return NextResponse.json({ error: 'После LIVE даты и фонд с карточки не правятся' }, { status: 409 });
	}
	const nextPool = parsed.data.prizePoolRub != null ? Math.round(parsed.data.prizePoolRub * 100) : current.prizePool;
	const prizeStatus = nextPrizeStatusAfterPoolChange(current, nextPool);
	const tournament = await prisma.tournament.update({
		where: { id },
		data: {
			...(parsed.data.title ? { title: parsed.data.title } : {}),
			...(parsed.data.description != null ? { description: parsed.data.description } : {}),
			...(parsed.data.rules != null ? { rules: parsed.data.rules } : {}),
			...(parsed.data.prizePoolRub != null ? { prizePool: nextPool } : {}),
			prizeStatus,
			...(parsed.data.startAt ? { startAt: new Date(parsed.data.startAt) } : {}),
			...(parsed.data.checkInOpensAt !== undefined
				? { checkInOpensAt: parsed.data.checkInOpensAt ? new Date(parsed.data.checkInOpensAt) : null }
				: {}),
			...(parsed.data.checkInClosesAt !== undefined
				? { checkInClosesAt: parsed.data.checkInClosesAt ? new Date(parsed.data.checkInClosesAt) : null }
				: {}),
			...(parsed.data.region != null ? { region: parsed.data.region } : {}),
			...(parsed.data.rankCap != null ? { rankCap: parsed.data.rankCap } : {}),
			...(parsed.data.seriesRules ? { seriesRules: parsed.data.seriesRules } : {}),
			...(parsed.data.maxTeams ? { maxTeams: parsed.data.maxTeams } : {}),
			...(parsed.data.aegisAward ? { aegisAward: parsed.data.aegisAward } : {}),
			...(parsed.data.inviteOnly != null ? { inviteOnly: parsed.data.inviteOnly } : {})
		}
	});
	await prisma.auditLog.create({
		data: {
			actorId: user.id,
			action: 'TOURNAMENT_EDITED',
			entity: 'Tournament',
			entityId: id,
			payload: { prizeStatus, prizePool: nextPool }
		}
	});
	return NextResponse.json({ tournament });
}
