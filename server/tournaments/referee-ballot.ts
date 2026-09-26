import { prisma } from '@/lib/prisma';
import { DomainError } from '@/server/errors';

export class AmbiguousNomineeError extends DomainError {
	readonly choices: Array<{ userId: string; displayName: string; steamId: string | null; rating: number; ratingGames: number }>;

	constructor(choices: AmbiguousNomineeError['choices']) {
		super('Несколько человек с похожим именем. Выберите из списка.', 409);
		this.choices = choices;
	}
}
import { searchArenaUsers } from '@/server/tournaments/staff';
import { pickUniqueArenaUser } from '@/lib/staff-policy';
import { BALLOT_APPLICATION_STATUSES, ballotOpen, refereeSeat } from '@/lib/referee-ballot';

const personSelect = {
	id: true,
	displayName: true,
	steamId: true,
	avatarUrl: true,
	rating: true,
	ratingGames: true
} as const;

async function loadCup(tournamentId: string) {
	const tournament = await prisma.tournament.findUnique({
		where: { id: tournamentId },
		select: {
			id: true,
			title: true,
			status: true,
			createdById: true,
			staff: { select: { userId: true, role: true } }
		}
	});
	if (!tournament) throw new DomainError('Турнир не найден', 404);
	return tournament;
}

export async function captainTeamId(tournamentId: string, userId: string) {
	const app = await prisma.teamApplication.findFirst({
		where: {
			tournamentId,
			status: { in: [...BALLOT_APPLICATION_STATUSES] },
			team: {
				deletedAt: null,
				OR: [
					{ createdById: userId },
					{ members: { some: { userId, role: 'captain', confirmed: true } } }
				]
			}
		},
		select: { teamId: true },
		orderBy: { createdAt: 'asc' }
	});
	return app?.teamId ?? null;
}

async function resolveNominee(query: string, ownerId: string | null, staff: Array<{ userId: string; role: string }>) {
	const rows = await searchArenaUsers(query);
	const picked = pickUniqueArenaUser(rows, query.trim());
	if (picked === 'ambiguous') {
		throw new AmbiguousNomineeError(
			rows.map((row) => ({
				userId: row.id,
				displayName: row.displayName,
				steamId: row.steamId,
				rating: row.rating,
				ratingGames: row.ratingGames
			}))
		);
	}
	if (!picked) throw new DomainError('Этот человек ещё не заходил на арену через Steam', 404);
	const seat = refereeSeat({
		userId: picked.id,
		ownerId,
		staffRole: staff.find((row) => row.userId === picked.id)?.role ?? null
	});
	if (seat === 'owner') throw new DomainError('Создатель турнира уже судья этой карточки', 400);
	if (seat === 'referee') throw new DomainError('Этот человек уже судья карточки', 400);
	return picked;
}

export async function nominateReferee(
	tournamentId: string,
	actorId: string,
	input: { userId?: string; query?: string }
) {
	const tournament = await loadCup(tournamentId);
	if (!ballotOpen(tournament.status)) throw new DomainError('Голосование за судью на этом кубке закрыто', 400);
	const teamId = await captainTeamId(tournamentId, actorId);
	if (!teamId) throw new DomainError('Предлагает капитан команды, которая в этом кубке', 403);

	const nominee = input.userId
		? await prisma.user.findFirst({ where: { id: input.userId, steamId: { not: null } }, select: personSelect })
		: null;
	const person = nominee ?? (input.query ? await resolveNominee(input.query, tournament.createdById, tournament.staff) : null);
	if (!person) throw new DomainError('Напишите ник человека, который уже заходил на арену', 400);
	if (input.userId) {
		const seat = refereeSeat({
			userId: person.id,
			ownerId: tournament.createdById,
			staffRole: tournament.staff.find((row) => row.userId === person.id)?.role ?? null
		});
		if (seat === 'owner') throw new DomainError('Создатель турнира уже судья этой карточки', 400);
		if (seat === 'referee') throw new DomainError('Этот человек уже судья карточки', 400);
	}

	const taken = await prisma.refereeNomination.findUnique({
		where: { tournamentId_nomineeId: { tournamentId, nomineeId: person.id } }
	});
	if (taken && taken.teamId !== teamId) throw new DomainError('Этого человека уже предложила другая команда', 409);
	const mine = await prisma.refereeNomination.findUnique({
		where: { tournamentId_teamId: { tournamentId, teamId } }
	});
	if (mine && mine.nomineeId !== person.id) {
		await prisma.refereeBallotVote.deleteMany({ where: { nominationId: mine.id } });
	}

	const row = await prisma.refereeNomination.upsert({
		where: { tournamentId_teamId: { tournamentId, teamId } },
		update: { nomineeId: person.id, proposedById: actorId },
		create: { tournamentId, teamId, nomineeId: person.id, proposedById: actorId }
	});

	if (person.id !== actorId) {
		await prisma.notification.create({
			data: {
				userId: person.id,
				type: 'REFEREE_NOMINATED',
				title: `Вас предложили судьёй: ${tournament.title}`,
				body: 'Капитаны голосуют на карточке кубка. Назначает организатор.',
				linkUrl: `/tournaments/${tournamentId}#staff`
			}
		});
	}
	await prisma.auditLog.create({
		data: {
			actorId,
			action: 'REFEREE_NOMINATED',
			entity: 'Tournament',
			entityId: tournamentId,
			payload: { nomineeId: person.id, teamId }
		}
	}).catch(() => undefined);
	return { id: row.id, nomineeId: person.id, displayName: person.displayName };
}

export async function voteReferee(tournamentId: string, actorId: string, nominationId: string) {
	const tournament = await loadCup(tournamentId);
	if (!ballotOpen(tournament.status)) throw new DomainError('Голосование за судью на этом кубке закрыто', 400);
	const teamId = await captainTeamId(tournamentId, actorId);
	if (!teamId) throw new DomainError('Голосует капитан команды, которая в этом кубке', 403);
	const nomination = await prisma.refereeNomination.findFirst({
		where: { id: nominationId, tournamentId },
		select: { id: true }
	});
	if (!nomination) throw new DomainError('Такого кандидата нет в голосовании', 404);
	await prisma.refereeBallotVote.upsert({
		where: { tournamentId_teamId: { tournamentId, teamId } },
		update: { nominationId, voterId: actorId },
		create: { tournamentId, nominationId, teamId, voterId: actorId }
	});
	await prisma.auditLog.create({
		data: {
			actorId,
			action: 'REFEREE_VOTE',
			entity: 'Tournament',
			entityId: tournamentId,
			payload: { nominationId, teamId }
		}
	}).catch(() => undefined);
	return { ok: true };
}

export async function listKnownReferees(excludeUserIds: string[]) {
	return prisma.user.findMany({
		where: {
			steamId: { not: null },
			tournamentStaff: { some: { role: 'REFEREE' } },
			id: excludeUserIds.length ? { notIn: excludeUserIds } : undefined
		},
		select: {
			...personSelect,
			tournamentStaff: { where: { role: 'REFEREE' }, select: { tournamentId: true } }
		},
		orderBy: [{ rating: 'desc' }, { displayName: 'asc' }],
		take: 12
	});
}

export async function listRefereeNominations(tournamentId: string) {
	return prisma.refereeNomination.findMany({
		where: { tournamentId },
		include: {
			nominee: { select: personSelect },
			proposedBy: { select: { displayName: true } },
			team: { select: { id: true, name: true } },
			votes: { select: { teamId: true } }
		},
		orderBy: { createdAt: 'asc' }
	});
}
