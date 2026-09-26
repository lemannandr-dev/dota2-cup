import { prisma } from '@/lib/prisma';
import { DomainError } from '@/server/errors';
import type { ReadyStatus } from '@/lib/tournament-copy';

export type Readiness = {
	status: ReadyStatus;
	notifiedAt?: string | null;
	respondedAt?: string | null;
};

type Snapshot = {
	readiness?: Readiness;
	[key: string]: unknown;
};

export function readReadiness(snapshot: unknown): Readiness {
	if (!snapshot || typeof snapshot !== 'object') return { status: 'PENDING' };
	const readiness = (snapshot as Snapshot).readiness;
	if (!readiness?.status) return { status: 'PENDING' };
	return {
		status: readiness.status,
		notifiedAt: readiness.notifiedAt ?? null,
		respondedAt: readiness.respondedAt ?? null
	};
}

export function isTournamentDay(startAt: Date, now = new Date()) {
	return now.toISOString().slice(0, 10) >= startAt.toISOString().slice(0, 10);
}

export function isBeforeTournamentStart(startAt: Date, now = new Date()) {
	return now < startAt;
}

export async function respondReadiness(tournamentId: string, teamId: string, userId: string, ready: boolean) {
	const tournament = await prisma.tournament.findUnique({ where: { id: tournamentId } });
	if (!tournament) throw new DomainError('Турнир не найден', 404);
	if (!isTournamentDay(tournament.startAt)) {
		throw new DomainError('Подтвердить готовность можно только в день турнира', 400);
	}

	const application = await prisma.teamApplication.findUnique({
		where: { teamId_tournamentId: { teamId, tournamentId } },
		include: { team: { include: { members: { select: { userId: true, role: true, confirmed: true } } } } }
	});
	if (!application) throw new DomainError('Заявка не найдена', 404);
	if (!['APPROVED', 'CHECKED_IN', 'IN_BRACKET'].includes(application.status)) {
		throw new DomainError('Эта команда ещё не в турнире', 400);
	}

	const allowed = application.team.createdById === userId
		|| application.team.members.some((member) => member.userId === userId && member.confirmed);
	if (!allowed) throw new DomainError('Ответить может только игрок состава', 403);

	const current = readReadiness(application.rosterSnapshot);
	const next: Readiness = {
		...current,
		status: ready ? 'READY' : 'DECLINED',
		respondedAt: new Date().toISOString()
	};
	const snapshot: Snapshot = {
		...((application.rosterSnapshot && typeof application.rosterSnapshot === 'object') ? application.rosterSnapshot as Snapshot : {}),
		readiness: next
	};

	const updated = await prisma.teamApplication.update({
		where: { id: application.id },
		data: {
			rosterSnapshot: snapshot as object,
			...(ready ? {} : { status: 'WITHDRAWN' })
		}
	});

	await prisma.auditLog.create({
		data: {
			actorId: userId,
			action: ready ? 'TEAM_READY' : 'TEAM_NOT_READY',
			entity: 'TeamApplication',
			entityId: application.id
		}
	}).catch(() => undefined);

	await syncReadyNotifications({
		tournamentId,
		teamId,
		tournamentTitle: tournament.title,
		teamName: application.team.name,
		ready,
		readerId: userId
	}).catch(() => undefined);

	return updated;
}

export function readyNoticeCopy(ready: boolean, tournamentTitle: string, teamName: string) {
	return ready
		? {
			title: `Готовность подтверждена: ${tournamentTitle}`,
			body: `Команда «${teamName}» подтвердила готовность к «${tournamentTitle}». Можно смотреть сетку.`
		}
		: {
			title: `Отказ от турнира: ${tournamentTitle}`,
			body: `Команда «${teamName}» не сможет сыграть в «${tournamentTitle}» и снята с турнира.`
		};
}

export async function syncReadyNotifications(input: {
	tournamentId: string;
	teamId: string;
	tournamentTitle: string;
	teamName: string;
	ready: boolean;
	readerId?: string;
}) {
	const copy = readyNoticeCopy(input.ready, input.tournamentTitle, input.teamName);
	const notes = await prisma.notification.findMany({
		where: { type: 'TOURNAMENT_READY', linkUrl: `/tournaments/${input.tournamentId}` }
	});
	const related = notes.filter((note) => {
		const meta = note.metadata && typeof note.metadata === 'object'
			? note.metadata as Record<string, unknown>
			: {};
		return meta.teamId === input.teamId && meta.tournamentId === input.tournamentId;
	});
	await Promise.all(related.map((note) => {
		const meta = (note.metadata && typeof note.metadata === 'object')
			? { ...(note.metadata as Record<string, unknown>) }
			: {};
		return prisma.notification.update({
			where: { id: note.id },
			data: {
				...copy,
				readAt: note.userId === input.readerId ? new Date() : note.readAt,
				metadata: {
					...meta,
					tournamentId: input.tournamentId,
					teamId: input.teamId,
					answered: input.ready ? 'READY' : 'DECLINED'
				}
			}
		});
	}));
}

export async function notifyTournamentDayReadiness(now = new Date()) {
	const tournaments = await prisma.tournament.findMany({
		where: {
			scrimBoard: false,
			status: { in: ['REGISTRATION', 'CHECK_IN', 'LIVE'] },
			startAt: { lte: new Date(now.getTime() + 24 * 60 * 60 * 1000) }
		},
		include: {
			applications: {
				where: { status: { in: ['APPROVED', 'CHECKED_IN', 'IN_BRACKET'] } },
				include: {
					team: {
						include: {
							members: { where: { confirmed: true }, select: { userId: true } }
						}
					}
				}
			}
		}
	});

	for (const tournament of tournaments) {
		if (!isTournamentDay(tournament.startAt, now)) continue;
		for (const application of tournament.applications) {
			const readiness = readReadiness(application.rosterSnapshot);
			if (readiness.notifiedAt || readiness.status !== 'PENDING') continue;

			const userIds = Array.from(new Set([
				application.team.createdById,
				...application.team.members.map((member) => member.userId)
			].filter(Boolean)));

			if (userIds.length) {
				await prisma.notification.createMany({
					data: userIds.map((userId) => ({
						userId,
						type: 'TOURNAMENT_READY',
						title: `Готовность: ${tournament.title}`,
						body: `Сегодня день турнира «${tournament.title}». Команда «${application.team.name}»: подтвердите готовность или откажитесь. Пока нет ответа — команда жёлтым в ожидании.`,
						linkUrl: `/tournaments/${tournament.id}`,
						metadata: {
							tournamentId: tournament.id,
							teamId: application.teamId,
							applicationId: application.id
						}
					}))
				});
			}

			const snapshot: Snapshot = {
				...((application.rosterSnapshot && typeof application.rosterSnapshot === 'object') ? application.rosterSnapshot as Snapshot : {}),
				readiness: { ...readiness, notifiedAt: now.toISOString() }
			};
			await prisma.teamApplication.update({
				where: { id: application.id },
				data: { rosterSnapshot: snapshot as object }
			});
		}
	}
}
