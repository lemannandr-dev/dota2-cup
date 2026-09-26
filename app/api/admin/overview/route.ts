import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAdmin } from '@/lib/rbac';
import { STAND_ADMIN_ID } from '@/lib/stand-admin';
import { describeEscrowWallet } from '@/lib/prize-places';
import { buildAdminAttention } from '@/lib/admin-desk';
import { loadAdminAttentionInput } from '@/server/admin/attention-data';
import { reconcileBalances } from '@/server/finance/reconcile';

export const dynamic = 'force-dynamic';

export async function GET() {
	const admin = await requireAdmin();
	if (!admin.ok) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

	const [counts, cups, disputes, reviews, transactions, audits, wallet, attentionExtra, reconcile] = await Promise.all([
		Promise.all([
			prisma.user.count(),
			prisma.user.count({ where: { steamId: { not: null } } }),
			prisma.tournament.count(),
			prisma.tournament.count({ where: { status: 'LIVE' } }),
			prisma.tournament.count({ where: { prizeStatus: 'UNCONFIRMED', prizePool: { gt: 0 } } }),
			prisma.team.count({ where: { deletedAt: null } }),
			prisma.transaction.count(),
			prisma.auditLog.count(),
			prisma.dispute.count({ where: { status: { in: ['OPEN', 'IN_REVIEW'] } } }),
			prisma.match.count({ where: { status: 'NEEDS_REVIEW' } })
		]),
		prisma.tournament.findMany({
			orderBy: { createdAt: 'desc' },
			take: 12,
			select: {
				id: true,
				title: true,
				status: true,
				prizePool: true,
				prizeStatus: true,
				startAt: true,
				createdById: true,
				_count: { select: { applications: true, matches: true } }
			}
		}),
		prisma.dispute.findMany({
			where: { status: { in: ['OPEN', 'IN_REVIEW'] } },
			orderBy: { createdAt: 'desc' },
			take: 12,
			select: {
				id: true,
				reason: true,
				status: true,
				matchId: true,
				match: {
					select: {
						id: true,
						tournamentId: true,
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
			take: 12,
			select: {
				id: true,
				tournamentId: true,
				scoreA: true,
				scoreB: true,
				teamA: { select: { name: true } },
				teamB: { select: { name: true } },
				tournament: { select: { title: true } }
			}
		}),
		prisma.transaction.findMany({
			orderBy: { createdAt: 'desc' },
			take: 8,
			select: {
				id: true,
				amount: true,
				type: true,
				description: true,
				createdAt: true,
				user: { select: { displayName: true } }
			}
		}),
		prisma.auditLog.findMany({
			orderBy: { createdAt: 'desc' },
			take: 8,
			select: { id: true, action: true, entity: true, createdAt: true }
		}),
		prisma.user.findUnique({
			where: { id: STAND_ADMIN_ID },
			select: { id: true, displayName: true, balance: true, totpEnabledAt: true }
		}),
		loadAdminAttentionInput(),
		reconcileBalances()
	]);

	const [users, steamUsers, cupCount, liveCups, unconfirmed, teams, txCount, auditCount, openDisputes, reviewCount] =
		counts;

	const ownerIds = [...new Set(cups.map((cup) => cup.createdById).filter((id): id is string => Boolean(id)))];
	const owners = ownerIds.length
		? await prisma.user.findMany({
				where: { id: { in: ownerIds } },
				select: { id: true, displayName: true, balance: true }
			})
		: [];
	const ownerById = new Map(owners.map((owner) => [owner.id, owner]));

	const cupRows = cups.map((cup) => {
		const owner = cup.createdById ? ownerById.get(cup.createdById) : undefined;
		const ownerBalance = owner?.balance ?? 0;
		const walletState = describeEscrowWallet({ prizePool: cup.prizePool, balance: ownerBalance });
		return {
			id: cup.id,
			title: cup.title,
			status: cup.status,
			prizePool: cup.prizePool,
			prizeStatus: cup.prizeStatus,
			startAt: cup.startAt,
			applications: cup._count.applications,
			matches: cup._count.matches,
			ownerId: cup.createdById,
			ownerName: owner?.displayName ?? 'без орга',
			ownerBalance,
			wallet: walletState
		};
	});

	const disputeRows = disputes.map((row) => ({
		id: row.id,
		matchId: row.matchId,
		tournamentId: row.match.tournamentId,
		tournamentTitle: row.match.tournament.title,
		pair: `${row.match.teamA?.name ?? 'А'} — ${row.match.teamB?.name ?? 'Б'}`,
		reason: row.reason,
		status: row.status
	}));

	const reviewRows = reviews.map((row) => ({
		id: row.id,
		tournamentId: row.tournamentId,
		tournamentTitle: row.tournament.title,
		pair: `${row.teamA?.name ?? 'А'} — ${row.teamB?.name ?? 'Б'}`,
		score: `${row.scoreA}:${row.scoreB}`
	}));

	return NextResponse.json({
		users,
		steamUsers,
		cups: cupCount,
		liveCups,
		unconfirmed,
		teams,
		transactions: txCount,
		audits: auditCount,
		openDisputes,
		reviewCount,
		wallet: wallet
			? {
					id: wallet.id,
					displayName: wallet.displayName,
					balance: wallet.balance,
					totp: Boolean(wallet.totpEnabledAt)
				}
			: null,
		attention: buildAdminAttention({
			cups: cupRows.map((cup) => ({
				id: cup.id,
				title: cup.title,
				prizePool: cup.prizePool,
				prizeStatus: cup.prizeStatus,
				ownerBalance: cup.ownerBalance,
				ownerId: cup.ownerId
			})),
			disputes: disputeRows,
			reviews: reviewRows,
			...attentionExtra
		}),
		reconcile: {
			ok: reconcile.ok,
			mismatchCount: reconcile.mismatches.length,
			globalDelta: reconcile.globalDelta
		},
		cupRows,
		disputeRows,
		reviewRows,
		recentTransactions: transactions.map((row) => ({
			id: row.id,
			amount: row.amount,
			type: row.type,
			description: row.description,
			createdAt: row.createdAt,
			who: row.user.displayName
		})),
		recentAudits: audits.map((row) => ({
			id: row.id,
			action: row.action,
			entity: row.entity,
			createdAt: row.createdAt
		}))
	});
}
