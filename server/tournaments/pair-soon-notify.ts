import { prisma } from '@/lib/prisma';
import { PAIR_SOON_TYPE, pairSoonDue, pairSoonNotifyRows } from '@/lib/pair-soon';

export async function notifyPairSoon(now = new Date()) {
	const matches = await prisma.match.findMany({
		where: {
			status: { in: ['SCHEDULED', 'LIVE'] },
			teamAId: { not: null },
			teamBId: { not: null },
			scrim: false,
			tournament: { status: { in: ['CHECK_IN', 'LIVE'] }, scrimBoard: false }
		},
		select: {
			id: true,
			status: true,
			startedAt: true,
			reportDeadlineAt: true,
			teamAId: true,
			teamBId: true,
			tournament: { select: { id: true, title: true } },
			teamA: {
				select: {
					name: true,
					createdById: true,
					members: { where: { confirmed: true }, select: { userId: true } }
				}
			},
			teamB: {
				select: {
					name: true,
					createdById: true,
					members: { where: { confirmed: true }, select: { userId: true } }
				}
			}
		}
	});
	const due = matches.filter((match) =>
		pairSoonDue({
			status: match.status,
			teamAId: match.teamAId,
			teamBId: match.teamBId,
			startedAt: match.startedAt,
			reportDeadlineAt: match.reportDeadlineAt,
			now
		})
	);
	if (!due.length) return;
	const already = await prisma.notification.findMany({
		where: {
			type: PAIR_SOON_TYPE,
			linkUrl: { in: due.map((match) => `/tournaments/${match.tournament.id}#match-${match.id}`) }
		},
		select: { userId: true, linkUrl: true }
	});
	const seen = new Set(already.map((row) => `${row.userId}:${row.linkUrl}`));
	const rows = due.flatMap((match) =>
		pairSoonNotifyRows({
			tournamentId: match.tournament.id,
			matchId: match.id,
			title: match.tournament.title,
			teamAName: match.teamA?.name,
			teamBName: match.teamB?.name,
			userIds: [
				match.teamA?.createdById,
				match.teamB?.createdById,
				...(match.teamA?.members.map((member) => member.userId) ?? []),
				...(match.teamB?.members.map((member) => member.userId) ?? [])
			].filter((id): id is string => Boolean(id))
		}).filter((row) => !seen.has(`${row.userId}:${row.linkUrl}`))
	);
	if (!rows.length) return;
	await prisma.notification.createMany({ data: rows });
}
