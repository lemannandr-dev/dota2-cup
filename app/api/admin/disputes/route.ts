import { NextRequest, NextResponse } from 'next/server';
import { DisputeStatus } from '@prisma/client';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { requireAdmin } from '@/lib/rbac';
import { disputeSlaLabel, isDisputeStale } from '@/lib/dispute-sla';

export async function GET() {
	const admin = await requireAdmin();
	if (!admin.ok) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
	const rows = await prisma.dispute.findMany({
		where: { status: { in: ['OPEN', 'IN_REVIEW'] } },
		orderBy: { createdAt: 'asc' },
		take: 80,
		select: {
			id: true,
			reason: true,
			details: true,
			status: true,
			createdAt: true,
			matchId: true,
			match: {
				select: {
					id: true,
					tournamentId: true,
					scoreA: true,
					scoreB: true,
					teamA: { select: { name: true } },
					teamB: { select: { name: true } },
					tournament: { select: { title: true } }
				}
			}
		}
	});
	const now = new Date();
	return NextResponse.json({
		disputes: rows.map((row) => ({
			id: row.id,
			matchId: row.matchId,
			tournamentId: row.match.tournamentId,
			tournamentTitle: row.match.tournament.title,
			pair: `${row.match.teamA?.name ?? 'А'} — ${row.match.teamB?.name ?? 'Б'}`,
			score: `${row.match.scoreA}:${row.match.scoreB}`,
			reason: row.reason,
			details: row.details,
			status: row.status,
			createdAt: row.createdAt,
			ageLabel: disputeSlaLabel(row.createdAt, now),
			stale: isDisputeStale(row.createdAt, now),
			href: `/tournaments/${row.match.tournamentId}#match-${row.matchId}`
		}))
	});
}

const patchSchema = z.object({
	id: z.string().min(1),
	status: z.enum(['IN_REVIEW', 'REJECTED'])
});

export async function PATCH(req: NextRequest) {
	const admin = await requireAdmin();
	if (!admin.ok) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
	const parsed = patchSchema.safeParse(await req.json());
	if (!parsed.success) return NextResponse.json({ error: 'Можно только взять на разбор или отклонить без счёта' }, { status: 400 });
	const current = await prisma.dispute.findUnique({ where: { id: parsed.data.id }, select: { id: true, status: true } });
	if (!current) return NextResponse.json({ error: 'Спор не найден' }, { status: 404 });
	const next = parsed.data.status as DisputeStatus;
	const dispute = await prisma.dispute.update({
		where: { id: current.id },
		data: {
			status: next,
			...(next === 'REJECTED'
				? { resolvedAt: new Date(), resolvedById: admin.user.id, resolution: 'Отклонено со стола админки без смены счёта' }
				: {})
		}
	});
	await prisma.auditLog.create({
		data: {
			actorId: admin.user.id,
			action: next === 'REJECTED' ? 'DISPUTE_REJECTED' : 'DISPUTE_REVIEW',
			entity: 'Dispute',
			entityId: dispute.id,
			payload: { from: current.status, to: next }
		}
	});
	return NextResponse.json({ dispute });
}
