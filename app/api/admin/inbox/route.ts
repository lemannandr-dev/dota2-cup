import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAdmin } from '@/lib/rbac';
import { buildAdminAttention } from '@/lib/admin-desk';
import { loadAdminAttentionInput } from '@/server/admin/attention-data';
import { adminInboxCounts, filterAdminInbox, type AdminInboxFilter } from '@/lib/admin-inbox';
import { disputeSlaLabel, isDisputeStale } from '@/lib/dispute-sla';

export const dynamic = 'force-dynamic';

const FILTERS = new Set<AdminInboxFilter>(['all', 'matchday', 'money', 'roster']);

export async function GET(req: Request) {
	const admin = await requireAdmin();
	if (!admin.ok) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

	const url = new URL(req.url);
	const raw = url.searchParams.get('filter') ?? 'all';
	const filter: AdminInboxFilter = FILTERS.has(raw as AdminInboxFilter) ? (raw as AdminInboxFilter) : 'all';
	const now = new Date();

	const [cups, disputes, reviews, extra] = await Promise.all([
		prisma.tournament.findMany({
			where: { prizeStatus: 'UNCONFIRMED', prizePool: { gt: 0 } },
			take: 24,
			select: {
				id: true,
				title: true,
				prizePool: true,
				prizeStatus: true,
				createdById: true
			}
		}),
		prisma.dispute.findMany({
			where: { status: { in: ['OPEN', 'IN_REVIEW'] } },
			orderBy: { createdAt: 'asc' },
			take: 40,
			select: {
				id: true,
				reason: true,
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
		}),
		prisma.match.findMany({
			where: { status: 'NEEDS_REVIEW' },
			orderBy: { updatedAt: 'desc' },
			take: 40,
			select: {
				id: true,
				tournamentId: true,
				scoreA: true,
				scoreB: true,
				teamA: { select: { name: true } },
				teamB: { select: { name: true } },
				tournament: { select: { title: true } },
				disputes: { where: { status: { in: ['OPEN', 'IN_REVIEW'] } }, select: { id: true }, take: 1 }
			}
		}),
		loadAdminAttentionInput(now)
	]);

	const ownerIds = [...new Set(cups.map((cup) => cup.createdById).filter((id): id is string => Boolean(id)))];
	const owners = ownerIds.length
		? await prisma.user.findMany({ where: { id: { in: ownerIds } }, select: { id: true, balance: true } })
		: [];
	const balanceByOwner = new Map(owners.map((row) => [row.id, row.balance]));

	const attention = buildAdminAttention({
		cups: cups.map((cup) => ({
			id: cup.id,
			title: cup.title,
			prizePool: cup.prizePool,
			prizeStatus: cup.prizeStatus,
			ownerBalance: cup.createdById ? balanceByOwner.get(cup.createdById) ?? 0 : 0,
			ownerId: cup.createdById
		})),
		disputes: disputes.map((row) => ({
			id: row.id,
			matchId: row.matchId,
			tournamentId: row.match.tournamentId,
			tournamentTitle: row.match.tournament.title,
			pair: `${row.match.teamA?.name ?? 'А'} — ${row.match.teamB?.name ?? 'Б'}`
		})),
		reviews: reviews
			.filter((row) => row.disputes.length === 0)
			.map((row) => ({
				id: row.id,
				tournamentId: row.tournamentId,
				tournamentTitle: row.tournament.title,
				pair: `${row.teamA?.name ?? 'А'} — ${row.teamB?.name ?? 'Б'}`
			})),
		...extra
	});

	const items = filterAdminInbox(attention, filter);

	return NextResponse.json({
		filter,
		counts: adminInboxCounts(attention),
		items,
		disputes: disputes.map((row) => ({
			id: row.id,
			matchId: row.matchId,
			tournamentId: row.match.tournamentId,
			tournamentTitle: row.match.tournament.title,
			pair: `${row.match.teamA?.name ?? 'А'} — ${row.match.teamB?.name ?? 'Б'}`,
			score: `${row.match.scoreA}:${row.match.scoreB}`,
			reason: row.reason,
			status: row.status,
			ageLabel: disputeSlaLabel(row.createdAt, now),
			stale: isDisputeStale(row.createdAt, now),
			href: `/tournaments/${row.match.tournamentId}#match-${row.matchId}`
		}))
	});
}
