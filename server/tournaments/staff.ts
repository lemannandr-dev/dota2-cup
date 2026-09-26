import { prisma } from '@/lib/prisma';
import { disputeSlaLabel, isDisputeStale } from '@/lib/dispute-sla';
import type { Role, StaffRole } from '@prisma/client';
import { DomainError } from '@/server/errors';
import {
	canAssignTournamentReferee,
	canRemoveTournamentStaff,
	parseRefereeLookup,
	pickUniqueArenaUser
} from '@/lib/staff-policy';

export function canCreateTournament(_role?: Role): boolean {
	void _role;
	return true;
}

export async function isTournamentStaff(userId: string, role: Role, tournamentId: string): Promise<boolean> {
	if (role === 'ADMIN') return true;
	const tournament = await prisma.tournament.findUnique({
		where: { id: tournamentId },
		select: { createdById: true, staff: { where: { userId }, select: { id: true } } }
	});
	if (!tournament) return false;
	return tournament.createdById === userId || tournament.staff.length > 0;
}

export async function isTournamentReferee(userId: string, role: Role, tournamentId: string): Promise<boolean> {
	if (role === 'ADMIN') return true;
	const tournament = await prisma.tournament.findUnique({
		where: { id: tournamentId },
		select: {
			createdById: true,
			staff: { where: { userId }, select: { role: true } }
		}
	});
	if (!tournament) return false;
	if (tournament.createdById === userId) return true;
	return tournament.staff.some((s) => s.role === 'OWNER' || s.role === 'ADMIN' || s.role === 'REFEREE');
}

export async function listRefereeUserIds(tournamentId: string): Promise<string[]> {
	const tournament = await prisma.tournament.findUnique({
		where: { id: tournamentId },
		select: {
			createdById: true,
			staff: { where: { role: { in: ['OWNER', 'ADMIN', 'REFEREE'] } }, select: { userId: true } }
		}
	});
	if (!tournament) return [];
	return Array.from(
		new Set([tournament.createdById, ...tournament.staff.map((row) => row.userId)].filter((id): id is string => Boolean(id)))
	);
}

export async function loadStaffActor(userId: string, role: Role, tournamentId: string) {
	const tournament = await prisma.tournament.findUnique({
		where: { id: tournamentId },
		select: {
			id: true,
			title: true,
			createdById: true,
			staff: { select: { userId: true, role: true } }
		}
	});
	if (!tournament) return null;
	const mine = tournament.staff.find((row) => row.userId === userId);
	return {
		tournament,
		actor: {
			userId,
			role,
			isOwner: tournament.createdById === userId,
			staffRole: mine?.role ?? null
		}
	};
}

const arenaUserSelect = {
	id: true,
	displayName: true,
	steamId: true,
	avatarUrl: true,
	rating: true,
	ratingGames: true
} as const;

export async function searchArenaUsers(query: string, excludeUserIds: string[] = []) {
	const lookup = parseRefereeLookup({ query });
	if (lookup.kind === 'empty' || lookup.kind === 'short') return [];
	if (lookup.kind === 'steamId') {
		const user = await prisma.user.findUnique({
			where: { steamId: lookup.steamId },
			select: arenaUserSelect
		});
		return user && !excludeUserIds.includes(user.id) ? [user] : [];
	}
	const name = lookup.kind === 'name' ? lookup.name : '';
	if (!name) return [];
	return prisma.user.findMany({
		where: {
			steamId: { not: null },
			id: excludeUserIds.length ? { notIn: excludeUserIds } : undefined,
			displayName: { contains: name, mode: 'insensitive' }
		},
		select: arenaUserSelect,
		orderBy: [{ rating: 'desc' }, { displayName: 'asc' }],
		take: 12
	});
}

export async function assignTournamentReferee(
	tournamentId: string,
	actorId: string,
	actorRole: Role,
	input: { userId?: string; steamId?: string; query?: string }
) {
	const gate = await loadStaffActor(actorId, actorRole, tournamentId);
	if (!gate) throw new DomainError('Турнир не найден', 404);
	if (!canAssignTournamentReferee(gate.actor)) {
		throw new DomainError('Судью назначает организатор турнира', 403);
	}
	const lookup = parseRefereeLookup(input);
	if (lookup.kind === 'empty' || lookup.kind === 'short') {
		throw new DomainError('Напишите имя на арене или SteamID64 человека, который уже заходил', 400);
	}
	const user =
		lookup.kind === 'userId'
			? await prisma.user.findFirst({
					where: { id: lookup.userId, steamId: { not: null } },
					select: { id: true, displayName: true, steamId: true }
				})
			: lookup.kind === 'steamId'
				? await prisma.user.findUnique({
						where: { steamId: lookup.steamId },
						select: { id: true, displayName: true, steamId: true }
					})
				: await resolveRefereeByName(lookup.name);
	if (!user) throw new DomainError('Этот человек ещё не заходил на арену через Steam', 404);
	if (user.id === gate.tournament.createdById) {
		throw new DomainError('Создатель турнира уже судья этой карточки', 400);
	}
	if (gate.tournament.staff.some((row) => row.userId === user.id && row.role === 'REFEREE')) {
		throw new DomainError('Этот человек уже судья карточки', 400);
	}
	await prisma.tournamentStaff.upsert({
		where: { tournamentId_userId: { tournamentId, userId: user.id } },
		update: { role: 'REFEREE' },
		create: { tournamentId, userId: user.id, role: 'REFEREE' }
	});
	await prisma.notification.create({
		data: {
			userId: user.id,
			type: 'STAFF_ASSIGNED',
			title: `Вас назначили судьёй: ${gate.tournament.title}`,
			body: 'Открывайте карточку турнира. Споры придут в колокольчик и в инбокс на главной.',
			linkUrl: `/tournaments/${tournamentId}`
		}
	});
	await prisma.auditLog.create({
		data: {
			actorId,
			action: 'STAFF_ASSIGNED',
			entity: 'Tournament',
			entityId: tournamentId,
			payload: { userId: user.id, role: 'REFEREE' }
		}
	}).catch(() => undefined);
	return { userId: user.id, displayName: user.displayName, steamId: user.steamId, role: 'REFEREE' as const };
}

async function resolveRefereeByName(name: string) {
	const rows = await searchArenaUsers(name);
	const picked = pickUniqueArenaUser(rows, name);
	if (picked === 'ambiguous') {
		throw new DomainError('Несколько человек с похожим именем. Выберите судью из списка.', 409);
	}
	return picked;
}

export async function removeTournamentReferee(tournamentId: string, actorId: string, actorRole: Role, targetUserId: string) {
	const gate = await loadStaffActor(actorId, actorRole, tournamentId);
	if (!gate) throw new DomainError('Турнир не найден', 404);
	const target = gate.tournament.staff.find((row) => row.userId === targetUserId);
	if (!target) throw new DomainError('Этого судьи нет в штабе', 404);
	if (
		!canRemoveTournamentStaff(gate.actor, {
			userId: target.userId,
			staffRole: target.role,
			isOwner: target.userId === gate.tournament.createdById
		})
	) {
		throw new DomainError('Организатора снять нельзя. Снимает только орг или админ сайта.', 403);
	}
	await prisma.tournamentStaff.delete({
		where: { tournamentId_userId: { tournamentId, userId: targetUserId } }
	});
	await prisma.auditLog.create({
		data: {
			actorId,
			action: 'STAFF_REMOVED',
			entity: 'Tournament',
			entityId: tournamentId,
			payload: { userId: targetUserId }
		}
	}).catch(() => undefined);
	return { ok: true };
}

export async function loadStaffDisputeInbox(userId: string) {
	const tournaments = await prisma.tournament.findMany({
		where: {
			OR: [{ createdById: userId }, { staff: { some: { userId } } }]
		},
		select: {
			id: true,
			title: true,
			createdById: true,
			matches: {
				where: {
					OR: [{ status: 'NEEDS_REVIEW' }, { disputes: { some: { status: { in: ['OPEN', 'IN_REVIEW'] } } } }]
				},
				select: {
					id: true,
					status: true,
					scoreA: true,
					scoreB: true,
					teamA: { select: { name: true } },
					teamB: { select: { name: true } },
					disputes: {
						where: { status: { in: ['OPEN', 'IN_REVIEW'] } },
						orderBy: { createdAt: 'desc' },
						take: 1,
						select: { reason: true, createdAt: true }
					}
				}
			}
		},
		orderBy: { updatedAt: 'desc' },
		take: 12
	});
	return tournaments.flatMap((tournament) =>
		tournament.matches.map((match) => {
			const openedAt = match.disputes[0]?.createdAt ?? new Date();
			return {
				tournamentId: tournament.id,
				title: tournament.title,
				matchId: match.id,
				href: `/tournaments/${tournament.id}#match-${match.id}`,
				teamA: match.teamA?.name ?? 'Команда A',
				teamB: match.teamB?.name ?? 'Команда B',
				score: `${match.scoreA}:${match.scoreB}`,
				reason: match.disputes[0]?.reason ?? 'NEEDS_REVIEW',
				openedAt: openedAt.toISOString(),
				ageLabel: disputeSlaLabel(openedAt),
				stale: isDisputeStale(openedAt)
			};
		})
	);
}

export async function ensureOwnerStaff(tournamentId: string, userId: string, role: StaffRole = 'OWNER') {
	await prisma.tournamentStaff.upsert({
		where: { tournamentId_userId: { tournamentId, userId } },
		update: { role },
		create: { tournamentId, userId, role }
	});
}
