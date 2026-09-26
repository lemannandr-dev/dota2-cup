import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCurrentSteamUser } from '@/server/auth/session';
import { canActOnMatch, isAllowedVodUrl } from '@/lib/access-policy';
import { loadMatchEvidenceGate, publicDisputeRow } from '@/server/disputes/gate';
import { notifyMatchParties } from '@/server/matches/notify';
import { z } from 'zod';

const openSchema = z.object({
	reason: z.enum([
		'WRONG_RESULT',
		'UNCONFIRMED_SUBSTITUTE',
		'NO_SHOW',
		'WRONG_LOBBY_SETTINGS',
		'DISCONNECT',
		'RULES_VIOLATION',
		'DISPUTED_MATCH_ID',
		'MISCONDUCT'
	]),
	details: z.string().max(5000).optional(),
	vodUrl: z.string().url().optional()
});

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
	const { id: matchId } = await params;
	const user = await getCurrentSteamUser();
	if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
	const gate = await loadMatchEvidenceGate(matchId, user);
	if (!gate) return NextResponse.json({ error: 'Матч не найден' }, { status: 404 });
	return NextResponse.json({
		canUpload: gate.canUpload,
		canView: gate.canView,
		disputes: gate.match.disputes.map((row) => publicDisputeRow(row, gate.canView))
	});
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
	const { id: matchId } = await params;
	try {
		const { assertSameOriginMutation } = await import('@/server/http/mutation-guards');
		const { assertRateLimit } = await import('@/server/rate-limit');
		assertSameOriginMutation(req);
		const user = await getCurrentSteamUser();
		if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
		await assertRateLimit(`match-dispute:${user.id}`, 20, 600);
		const userId = user.id;

		const parsed = openSchema.safeParse(await req.json());
		if (!parsed.success) return NextResponse.json({ error: 'Некорректная причина спора' }, { status: 400 });

		const match = await prisma.match.findUnique({
			where: { id: matchId },
			include: {
				teamA: { select: { createdById: true, name: true } },
				teamB: { select: { createdById: true, name: true } },
				tournament: { select: { id: true, title: true, createdById: true } }
			}
		});
		if (!match) return NextResponse.json({ error: 'Матч не найден' }, { status: 404 });

		if (!canActOnMatch(userId, match.teamA?.createdById, match.teamB?.createdById)) {
			return NextResponse.json({ error: 'Спор открывает капитан участвующей команды' }, { status: 403 });
		}
		if (parsed.data.vodUrl && !isAllowedVodUrl(parsed.data.vodUrl)) {
			return NextResponse.json({ error: 'Нужна https-ссылка YouTube или Twitch' }, { status: 400 });
		}

		const openExisting = await prisma.dispute.findFirst({
			where: { matchId, status: { in: ['OPEN', 'IN_REVIEW'] }, openedById: userId },
			orderBy: { createdAt: 'desc' }
		});
		if (openExisting) {
			return NextResponse.json({ dispute: openExisting, replayed: true }, { status: 200 });
		}

		const dispute = await prisma.$transaction(async (db) => {
			const d = await db.dispute.create({
				data: {
					matchId,
					openedById: userId,
					reason: parsed.data.reason,
					details: parsed.data.details,
					evidenceUrl: parsed.data.vodUrl ?? null,
					evidenceKind: parsed.data.vodUrl ? 'vod' : null,
					evidenceName: parsed.data.vodUrl ? 'VOD' : null
				}
			});
			await db.match.update({ where: { id: matchId }, data: { status: 'NEEDS_REVIEW' } });
			await db.auditLog.create({
				data: { actorId: userId, action: 'DISPUTE_OPENED', entity: 'Dispute', entityId: d.id }
			});
			return d;
		});

		await notifyMatchParties({
			kind: 'dispute_opened',
			actorId: userId,
			tournamentId: match.tournament.id,
			tournamentTitle: match.tournament.title,
			ownerId: match.tournament.createdById,
			matchId,
			teamA: match.teamA,
			teamB: match.teamB
		});

		return NextResponse.json({ dispute }, { status: 201 });
	} catch (error) {
		const { DomainError, toErrorResponse } = await import('@/server/errors');
		if (error instanceof DomainError) {
			return NextResponse.json({ error: error.message }, { status: error.status });
		}
		const mapped = toErrorResponse(error);
		return NextResponse.json({ error: mapped.error }, { status: mapped.status });
	}
}

const resolveSchema = z.object({
	disputeId: z.string().min(1),
	status: z.enum(['RESOLVED', 'REJECTED']),
	resolution: z.string().min(3).max(5000)
});

// Arbiter decision: admins only; the audit trail is immutable.
export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
	const { id: matchId } = await params;
	const user = await getCurrentSteamUser();
	if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
	const match = await prisma.match.findUnique({
		where: { id: matchId },
		include: {
			teamA: { select: { createdById: true, name: true } },
			teamB: { select: { createdById: true, name: true } },
			tournament: { select: { id: true, title: true, createdById: true } }
		}
	});
	if (!match) return NextResponse.json({ error: 'Матч не найден' }, { status: 404 });
	const { isTournamentReferee } = await import('@/server/tournaments/staff');
	if (!(await isTournamentReferee(user.id, user.role, match.tournament.id))) {
		return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
	}
	const userId = user.id;

	const parsed = resolveSchema.safeParse(await req.json());
	if (!parsed.success) return NextResponse.json({ error: 'Некорректное решение' }, { status: 400 });

	const dispute = await prisma.dispute.findUnique({ where: { id: parsed.data.disputeId } });
	if (!dispute || dispute.matchId !== matchId) {
		return NextResponse.json({ error: 'Спор не найден' }, { status: 404 });
	}

	const updated = await prisma.$transaction(async (db) => {
		const d = await db.dispute.update({
			where: { id: dispute.id },
			data: {
				status: parsed.data.status,
				resolution: parsed.data.resolution,
				resolvedById: userId,
				resolvedAt: new Date()
			}
		});
		await db.auditLog.create({
			data: { actorId: userId, action: 'DISPUTE_RESOLVED', entity: 'Dispute', entityId: d.id, payload: { status: parsed.data.status } }
		});
		return d;
	});

	await notifyMatchParties({
		kind: 'dispute_resolved',
		actorId: userId,
		tournamentId: match.tournament.id,
		tournamentTitle: match.tournament.title,
		ownerId: match.tournament.createdById,
		teamA: match.teamA,
		teamB: match.teamB,
		resolution: parsed.data.resolution
	});

	return NextResponse.json({ dispute: updated });
}
