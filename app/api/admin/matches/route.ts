import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAdmin } from '@/lib/rbac';
import { MatchStatus } from '@prisma/client';
import { z } from 'zod';

export async function GET() {
	const admin = await requireAdmin();
	if (!admin.ok) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
	const matches = await prisma.match.findMany({
		where: {
			OR: [{ status: { not: 'PENDING' } }, { teamAId: { not: null } }, { teamBId: { not: null } }]
		},
		orderBy: { updatedAt: 'desc' },
		take: 80,
		select: {
			id: true,
			status: true,
			scoreA: true,
			scoreB: true,
			bestOf: true,
			round: true,
			bracket: true,
			winnerTeamId: true,
			dotaMatchIds: true,
			reportDeadlineAt: true,
			tournamentId: true,
			tournament: { select: { title: true } },
			teamA: { select: { name: true } },
			teamB: { select: { name: true } },
			disputes: { where: { status: { in: ['OPEN', 'IN_REVIEW'] } }, select: { id: true, reason: true, status: true } }
		}
	});
	return NextResponse.json({
		matches: matches.map((match) => ({
			id: match.id,
			status: match.status,
			scoreA: match.scoreA,
			scoreB: match.scoreB,
			score: `${match.scoreA}:${match.scoreB}`,
			bestOf: match.bestOf,
			round: match.round,
			bracket: match.bracket,
			hasTeamA: Boolean(match.teamA),
			hasTeamB: Boolean(match.teamB),
			teamA: match.teamA?.name ?? null,
			teamB: match.teamB?.name ?? null,
			hasWinner: Boolean(match.winnerTeamId),
			dotaMatchCount: match.dotaMatchIds.length,
			reportDeadlineAt: match.reportDeadlineAt?.toISOString() ?? null,
			tournamentId: match.tournamentId,
			tournamentTitle: match.tournament.title,
			disputes: match.disputes
		}))
	});
}

const patchSchema = z.object({
	id: z.string().min(1),
	status: z.nativeEnum(MatchStatus)
});

export async function PATCH(req: NextRequest) {
	const admin = await requireAdmin();
	if (!admin.ok) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
	const parsed = patchSchema.safeParse(await req.json());
	if (!parsed.success) return NextResponse.json({ error: 'Validation failed' }, { status: 400 });
	const match = await prisma.match.update({
		where: { id: parsed.data.id },
		data: { status: parsed.data.status }
	});
	await prisma.auditLog.create({
		data: {
			actorId: admin.user.id,
			action: 'MATCH_ADMIN_PATCH',
			entity: 'Match',
			entityId: match.id,
			payload: { status: parsed.data.status }
		}
	});
	return NextResponse.json({ match });
}
