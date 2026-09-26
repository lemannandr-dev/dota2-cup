import { prisma } from '@/lib/prisma';
import { DomainError } from '@/server/errors';
import {
	applicationRemindNotifyRows,
	collectRemindUserIds,
	recipientsForRemind,
	type ApplicationDeskRow,
	type ApplicationRemindKind
} from '@/lib/application-desk';
import { readReadiness } from '@/server/tournaments/readiness';

export async function remindTournamentApplications(
	tournamentId: string,
	actorId: string,
	kind: ApplicationRemindKind
) {
	const tournament = await prisma.tournament.findUnique({
		where: { id: tournamentId },
		select: {
			id: true,
			title: true,
			status: true,
			startAt: true,
			applications: {
				select: {
					id: true,
					status: true,
					rosterSnapshot: true,
					team: {
						select: {
							name: true,
							createdById: true,
							members: { where: { confirmed: true }, select: { userId: true } }
						}
					}
				}
			}
		}
	});
	if (!tournament) throw new DomainError('Турнир не найден', 404);

	const deskRows: ApplicationDeskRow[] = tournament.applications.map((app) => ({
		id: app.id,
		status: app.status,
		readyStatus: readReadiness(app.rosterSnapshot).status,
		team: { name: app.team.name },
		captainId: app.team.createdById,
		memberIds: app.team.members.map((member) => member.userId)
	}));

	const targets = recipientsForRemind(deskRows, kind, {
		tournamentStatus: tournament.status,
		startAt: tournament.startAt?.toISOString() ?? null
	});
	if (targets.length === 0) {
		throw new DomainError('Нет команд для этого напоминания', 400);
	}

	const userIds = collectRemindUserIds(targets);
	const rows = applicationRemindNotifyRows({
		kind,
		tournamentId: tournament.id,
		title: tournament.title,
		userIds
	});
	if (rows.length === 0) throw new DomainError('Некому слать напоминание', 400);

	await prisma.notification.createMany({ data: rows });
	await prisma.auditLog.create({
		data: {
			actorId,
			action: 'APPLICATION_BULK_REMIND',
			entity: 'Tournament',
			entityId: tournamentId,
			payload: { kind, teams: targets.length, users: rows.length }
		}
	});

	const first = rows[0];
	const { sendWebPushToUsers } = await import('@/server/notify/web-push');
	const push = await sendWebPushToUsers(userIds, {
		title: first.title,
		body: first.body,
		url: first.linkUrl
	}).catch(() => ({ sent: 0, gone: 0 }));

	return { kind, teams: targets.length, notified: rows.length, pushed: push.sent };
}
