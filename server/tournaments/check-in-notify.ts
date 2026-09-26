import { prisma } from '@/lib/prisma';
import { checkInNotifyRows } from '@/lib/check-in-notify';

export async function notifyCheckInOpened(tournamentIds: string[]) {
	if (tournamentIds.length === 0) return;
	const tournaments = await prisma.tournament.findMany({
		where: { id: { in: tournamentIds } },
		select: {
			id: true,
			title: true,
			applications: {
				where: { status: { in: ['APPROVED', 'SUBMITTED', 'CHECKED_IN'] } },
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
	const rows = tournaments.flatMap((tournament) =>
		checkInNotifyRows({
			tournamentId: tournament.id,
			title: tournament.title,
			userIds: tournament.applications.flatMap((app) => [
				app.team.createdById,
				...app.team.members.map((member) => member.userId)
			])
		})
	);
	if (rows.length === 0) return;
	await prisma.notification.createMany({ data: rows });
	const { pingTournamentExternal } = await import('@/server/notify/external');
	await Promise.allSettled(
		tournaments.map((tournament) =>
			pingTournamentExternal({
				tournamentId: tournament.id,
				ping: {
					title: `Отметка состава: ${tournament.title}`,
					body: 'Окно отметки открыто. Капитан подтверждает явку пятёрки на карточке турнира.',
					linkUrl: `/tournaments/${tournament.id}`
				}
			})
		)
	);
}
