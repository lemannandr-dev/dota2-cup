import { prisma } from '@/lib/prisma';
import { buildAdminAttention, isOverdueReport, isStuckBracket } from '@/lib/admin-desk';

export async function loadAdminAttentionInput(now = new Date()) {
	const stuckBracketCutoff = new Date(now.getTime() - 2 * 60 * 1000);

	const [overdueMatches, noCheckInCups, unpaidCups, stuckEscrows, stuckBracketCups] = await Promise.all([
		prisma.match.findMany({
			where: {
				scrim: false,
				reportDeadlineAt: { lt: now },
				status: { notIn: ['COMPLETED', 'TECHNICAL'] }
			},
			orderBy: { reportDeadlineAt: 'asc' },
			take: 20,
			select: {
				id: true,
				status: true,
				reportDeadlineAt: true,
				tournamentId: true,
				teamA: { select: { name: true } },
				teamB: { select: { name: true } },
				tournament: { select: { title: true } }
			}
		}),
		prisma.tournament.findMany({
			where: {
				status: { in: ['CHECK_IN', 'LIVE'] },
				checkInClosesAt: { lte: now },
				applications: { some: { status: { in: ['SUBMITTED', 'APPROVED', 'NEEDS_ACTION'] } } }
			},
			select: {
				id: true,
				title: true,
				_count: {
					select: {
						applications: { where: { status: { in: ['SUBMITTED', 'APPROVED', 'NEEDS_ACTION'] } } }
					}
				}
			},
			take: 12
		}),
		prisma.tournament.findMany({
			where: {
				status: 'FINISHED',
				prizeStatus: 'CONFIRMED',
				prizeAllocations: { some: { status: 'RESERVED', amount: { gt: 0 } } }
			},
			select: {
				id: true,
				title: true,
				_count: { select: { prizeAllocations: { where: { status: 'RESERVED', amount: { gt: 0 } } } } }
			},
			take: 12
		}),
		prisma.tournament.findMany({
			where: { status: 'CANCELLED', prizeStatus: 'CONFIRMED', prizePool: { gt: 0 } },
			select: { id: true, title: true, prizePool: true },
			take: 12
		}),
		prisma.tournament.findMany({
			where: {
				status: 'CHECK_IN',
				checkInClosesAt: { lte: stuckBracketCutoff },
				matches: { none: {} },
				applications: { some: { status: 'CHECKED_IN' } }
			},
			select: {
				id: true,
				title: true,
				checkInClosesAt: true,
				_count: { select: { matches: true, applications: { where: { status: 'CHECKED_IN' } } } }
			},
			take: 12
		})
	]);

	return {
		overdueReports: overdueMatches
			.filter((match) => isOverdueReport({ reportDeadlineAt: match.reportDeadlineAt ?? null, status: match.status }))
			.map((match) => ({
				id: match.id,
				tournamentId: match.tournamentId,
				tournamentTitle: match.tournament.title,
				pair: `${match.teamA?.name ?? 'А'} — ${match.teamB?.name ?? 'Б'}`
			})),
		noCheckInCups: noCheckInCups.map((cup) => ({
			id: cup.id,
			title: cup.title,
			pendingCount: cup._count.applications
		})),
		unpaidPrizes: unpaidCups.map((cup) => ({
			id: cup.id,
			title: cup.title,
			reservedCount: cup._count.prizeAllocations
		})),
		stuckEscrows: stuckEscrows.map((cup) => ({
			id: cup.id,
			title: cup.title,
			prizePool: cup.prizePool
		})),
		stuckBrackets: stuckBracketCups
			.filter((cup) =>
				isStuckBracket({
					status: 'CHECK_IN',
					checkInClosesAt: cup.checkInClosesAt,
					matchCount: cup._count.matches,
					checkedInCount: cup._count.applications,
					now
				})
			)
			.map((cup) => ({
				id: cup.id,
				title: cup.title,
				checkedInCount: cup._count.applications
			}))
	};
}

export async function loadStaffAttentionInbox(userId: string, now = new Date()) {
	const tournaments = await prisma.tournament.findMany({
		where: {
			OR: [{ createdById: userId }, { staff: { some: { userId } } }]
		},
		select: {
			id: true,
			title: true,
			status: true,
			prizePool: true,
			prizeStatus: true,
			checkInClosesAt: true,
			createdById: true,
			_count: { select: { matches: true, applications: { where: { status: 'CHECKED_IN' } } } },
			matches: {
				where: {
					OR: [
						{ reportDeadlineAt: { lt: now }, status: { notIn: ['COMPLETED', 'TECHNICAL'] } },
						{ status: 'NEEDS_REVIEW' },
						{ disputes: { some: { status: { in: ['OPEN', 'IN_REVIEW'] } } } }
					]
				},
				select: {
					id: true,
					status: true,
					reportDeadlineAt: true,
					scoreA: true,
					scoreB: true,
					teamA: { select: { name: true } },
					teamB: { select: { name: true } },
					disputes: {
						where: { status: { in: ['OPEN', 'IN_REVIEW'] } },
						orderBy: { createdAt: 'desc' },
						take: 1,
						select: { id: true, reason: true, createdAt: true }
					}
				}
			},
			prizeAllocations: { where: { status: 'RESERVED', amount: { gt: 0 } }, select: { id: true } },
			applications: {
				where: { status: { in: ['SUBMITTED', 'APPROVED', 'NEEDS_ACTION'] } },
				select: { id: true }
			}
		},
		orderBy: { updatedAt: 'desc' },
		take: 24
	});

	const ownerIds = [...new Set(tournaments.map((t) => t.createdById).filter(Boolean))] as string[];
	const owners = ownerIds.length
		? await prisma.user.findMany({ where: { id: { in: ownerIds } }, select: { id: true, balance: true } })
		: [];
	const ownerBalance = new Map(owners.map((o) => [o.id, o.balance]));

	const disputes = tournaments.flatMap((tournament) =>
		tournament.matches
			.filter((match) => match.disputes.length > 0)
			.map((match) => ({
				id: match.disputes[0]!.id,
				matchId: match.id,
				tournamentId: tournament.id,
				tournamentTitle: tournament.title,
				pair: `${match.teamA?.name ?? 'А'} — ${match.teamB?.name ?? 'Б'}`
			}))
	);

	const reviews = tournaments.flatMap((tournament) =>
		tournament.matches
			.filter((match) => match.status === 'NEEDS_REVIEW' && match.disputes.length === 0)
			.map((match) => ({
				id: match.id,
				tournamentId: tournament.id,
				tournamentTitle: tournament.title,
				pair: `${match.teamA?.name ?? 'А'} — ${match.teamB?.name ?? 'Б'}`
			}))
	);

	const overdueReports = tournaments.flatMap((tournament) =>
		tournament.matches
			.filter((match) => isOverdueReport({ reportDeadlineAt: match.reportDeadlineAt, status: match.status }))
			.map((match) => ({
				id: match.id,
				tournamentId: tournament.id,
				tournamentTitle: tournament.title,
				pair: `${match.teamA?.name ?? 'А'} — ${match.teamB?.name ?? 'Б'}`
			}))
	);

	return buildAdminAttention({
		cups: tournaments
			.filter((t) => t.prizeStatus === 'UNCONFIRMED' && t.prizePool > 0)
			.map((t) => ({
				id: t.id,
				title: t.title,
				prizePool: t.prizePool,
				prizeStatus: t.prizeStatus,
				ownerBalance: t.createdById ? (ownerBalance.get(t.createdById) ?? 0) : 0,
				ownerId: t.createdById
			})),
		disputes,
		reviews,
		overdueReports,
		noCheckInCups: tournaments
			.filter(
				(t) =>
					t.checkInClosesAt &&
					new Date(t.checkInClosesAt) <= now &&
					t.applications.length > 0
			)
			.map((t) => ({ id: t.id, title: t.title, pendingCount: t.applications.length })),
		unpaidPrizes: tournaments
			.filter((t) => t.status === 'FINISHED' && t.prizeAllocations.length > 0)
			.map((t) => ({ id: t.id, title: t.title, reservedCount: t.prizeAllocations.length })),
		stuckEscrows: tournaments
			.filter((t) => t.status === 'CANCELLED' && t.prizeStatus === 'CONFIRMED' && t.prizePool > 0)
			.map((t) => ({ id: t.id, title: t.title, prizePool: t.prizePool })),
		stuckBrackets: tournaments
			.filter((t) =>
				isStuckBracket({
					status: t.status,
					checkInClosesAt: t.checkInClosesAt,
					matchCount: t._count.matches,
					checkedInCount: t._count.applications,
					now
				})
			)
			.map((t) => ({ id: t.id, title: t.title, checkedInCount: t._count.applications }))
	});
}
