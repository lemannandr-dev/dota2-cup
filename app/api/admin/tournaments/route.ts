import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAdmin } from '@/lib/rbac';
import { TournamentStatus } from '@prisma/client';
import { z } from 'zod';

export async function GET(req: NextRequest) {
	const admin = await requireAdmin();
	if (!admin.ok) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
	const status = new URL(req.url).searchParams.get('status');
	const tournaments = await prisma.tournament.findMany({
		where: status && status in TournamentStatus ? { status: status as TournamentStatus } : {},
		orderBy: { createdAt: 'desc' },
		take: 50,
		select: {
			id: true,
			title: true,
			description: true,
			rules: true,
			format: true,
			status: true,
			maxTeams: true,
			seriesRules: true,
			region: true,
			prizePool: true,
			prizeCurrency: true,
			prizeStatus: true,
			startAt: true,
			checkInOpensAt: true,
			checkInClosesAt: true,
			createdById: true,
			_count: { select: { applications: true, matches: true } },
			applications: { select: { status: true } }
		}
	});
	const ownerIds = [...new Set(tournaments.map((cup) => cup.createdById).filter((id): id is string => Boolean(id)))];
	const owners = ownerIds.length
		? await prisma.user.findMany({
				where: { id: { in: ownerIds } },
				select: { id: true, displayName: true, balance: true, totpEnabledAt: true }
			})
		: [];
	const ownerById = new Map(owners.map((owner) => [owner.id, owner]));
	return NextResponse.json({
		tournaments: tournaments.map((cup) => {
			const owner = cup.createdById ? ownerById.get(cup.createdById) : undefined;
			return {
				id: cup.id,
				title: cup.title,
				description: cup.description,
				rules: cup.rules,
				format: cup.format,
				status: cup.status,
				maxTeams: cup.maxTeams,
				seriesRules: cup.seriesRules,
				region: cup.region,
				prizePool: cup.prizePool,
				prizeCurrency: cup.prizeCurrency,
				prizeStatus: cup.prizeStatus,
				startAt: cup.startAt.toISOString(),
				checkInOpensAt: cup.checkInOpensAt?.toISOString() ?? null,
				checkInClosesAt: cup.checkInClosesAt?.toISOString() ?? null,
				createdById: cup.createdById,
				ownerName: owner?.displayName ?? null,
				ownerBalance: owner?.balance ?? 0,
				ownerTotp: Boolean(owner?.totpEnabledAt),
				applications: cup._count.applications,
				matches: cup._count.matches,
				applicationStatuses: cup.applications.map((row) => row.status)
			};
		})
	});
}

const patchSchema = z.object({
	id: z.string().min(1),
	title: z.string().min(2).max(120).optional(),
	status: z.nativeEnum(TournamentStatus).optional(),
	prizePool: z.number().int().min(0).optional(),
	prizeStatus: z.enum(['NONE', 'UNCONFIRMED']).optional()
});

export async function PATCH(req: NextRequest) {
	const admin = await requireAdmin();
	if (!admin.ok) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
	const parsed = patchSchema.safeParse(await req.json());
	if (!parsed.success) return NextResponse.json({ error: 'Validation failed' }, { status: 400 });
	const current = await prisma.tournament.findUnique({
		where: { id: parsed.data.id },
		select: { id: true, title: true, status: true, prizePool: true, prizeStatus: true }
	});
	if (!current) return NextResponse.json({ error: 'Турнир не найден' }, { status: 404 });
	const tournament = await prisma.tournament.update({
		where: { id: current.id },
		data: {
			...(parsed.data.title ? { title: parsed.data.title } : {}),
			...(parsed.data.status ? { status: parsed.data.status } : {}),
			...(parsed.data.prizePool != null ? { prizePool: parsed.data.prizePool } : {}),
			...(parsed.data.prizeStatus ? { prizeStatus: parsed.data.prizeStatus } : {})
		}
	});
	await prisma.auditLog.create({
		data: {
			actorId: admin.user.id,
			action: 'TOURNAMENT_ADMIN_PATCH',
			entity: 'Tournament',
			entityId: tournament.id,
			payload: { from: current, to: parsed.data }
		}
	});
	return NextResponse.json({ tournament });
}

export async function DELETE(req: NextRequest) {
	const admin = await requireAdmin();
	if (!admin.ok) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
	const id = new URL(req.url).searchParams.get('id');
	if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 });
	const tournament = await prisma.tournament.update({
		where: { id },
		data: { status: 'CANCELLED' }
	});
	await prisma.auditLog.create({
		data: {
			actorId: admin.user.id,
			action: 'TOURNAMENT_CANCELLED',
			entity: 'Tournament',
			entityId: id,
			payload: { via: 'admin' }
		}
	});
	return NextResponse.json({ tournament });
}
