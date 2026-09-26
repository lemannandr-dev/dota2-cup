import { prisma } from '@/lib/prisma';
import { isMatchSoonWindow, MATCH_SOON_TYPE, matchSoonNotifyRows } from '@/lib/match-soon';

export async function notifyMatchSoon(now = new Date()) {
	const tournaments = await prisma.tournament.findMany({
		where: { scrimBoard: false, status: { in: ['CHECK_IN', 'LIVE'] } },
		select: {
			id: true,
			title: true,
			startAt: true,
			applications: {
				where: { status: { in: ['APPROVED', 'CHECKED_IN', 'IN_BRACKET'] } },
				select: {
					team: {
						select: {
							createdById: true,
							members: { where: { confirmed: true }, select: { userId: true } }
						}
					}
				}
			}
		}
	});
	const due = tournaments.filter((tournament) => isMatchSoonWindow(tournament.startAt, now));
	if (due.length === 0) return;

	const already = await prisma.notification.findMany({
		where: {
			type: MATCH_SOON_TYPE,
			linkUrl: { in: due.map((tournament) => `/tournaments/${tournament.id}`) }
		},
		select: { userId: true, linkUrl: true }
	});
	const seen = new Set(already.map((row) => `${row.userId}:${row.linkUrl}`));

	const rows = due.flatMap((tournament) =>
		matchSoonNotifyRows({
			tournamentId: tournament.id,
			title: tournament.title,
			userIds: tournament.applications.flatMap((app) => [app.team.createdById, ...app.team.members.map((member) => member.userId)])
		}).filter((row) => !seen.has(`${row.userId}:${row.linkUrl}`))
	);
	if (rows.length === 0) return;
	await prisma.notification.createMany({ data: rows });

	const { pingTournamentExternal } = await import('@/server/notify/external');
	await Promise.allSettled(
		due.map((tournament) =>
			pingTournamentExternal({
				tournamentId: tournament.id,
				ping: {
					title: `Скоро катка: ${tournament.title}`,
					body: 'До старта меньше получаса. Откройте карточку: лобби, пароль и голосовой.',
					linkUrl: `/tournaments/${tournament.id}`
				}
			})
		)
	);
}
