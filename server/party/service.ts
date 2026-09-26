import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { countMainRoster, inviteRosterBlock, teamRosterLocked, partySearchHref } from '@/lib/team-roster';
import { generateSessionToken, hashToken } from '@/lib/steam';
import { DomainError } from '@/server/errors';

type Db = Prisma.TransactionClient;
const teamInclude = {
	createdBy: { select: { id: true, displayName: true, avatarUrl: true } },
	members: { orderBy: { joinedAt: 'asc' as const }, include: { user: { select: { id: true, displayName: true, avatarUrl: true, steamId: true } } } },
	applications: { include: { tournament: { select: { id: true, title: true, status: true } } } }
} satisfies Prisma.TeamInclude;
type PartyTeam = Prisma.TeamGetPayload<{ include: typeof teamInclude }>;
const ACTIVE_APPLICATIONS = ['SUBMITTED', 'APPROVED', 'WAITLIST', 'CHECKED_IN', 'IN_BRACKET'] as const;

export async function lockParty(db: Db, teamId: string) {
	await db.$executeRaw`SELECT id FROM "Team" WHERE id = ${teamId} FOR UPDATE`;
}

export async function refreshPartyApplications(db: Db, teamId: string) {
	const members = await db.teamMember.findMany({ where: { teamId, confirmed: true, isSubstitute: false }, include: { user: { select: { steamId: true, displayName: true } } } });
	const snapshot = members.map((m) => ({ userId: m.userId, steamId: m.user.steamId, displayName: m.user.displayName }));
	await db.teamApplication.updateMany({
		where: { teamId, status: { in: ['SUBMITTED', 'APPROVED'] }, tournament: { status: { in: ['REGISTRATION', 'CHECK_IN'] } } },
		data: { status: 'SUBMITTED', rosterSnapshot: snapshot }
	});
	await db.teamApplication.updateMany({ where: { teamId, status: 'WAITLIST' }, data: { rosterSnapshot: snapshot } });
}

function isMember(team: PartyTeam, userId: string) {
	return team.createdById === userId || team.members.some((member) => member.userId === userId && member.confirmed);
}

function isLocked(team: PartyTeam) {
	return teamRosterLocked(team.applications.filter((app) => !['FINISHED', 'CANCELLED'].includes(app.tournament.status)));
}

function assertOpen(team: PartyTeam) {
	if (team.deletedAt) throw new DomainError('Пати распущено.', 410);
	if (isLocked(team)) throw new DomainError('Состав зафиксирован для кубка. Замена доступна на странице турнира.', 409);
}

export function partyView(team: PartyTeam, viewerId: string) {
	const roster = countMainRoster(team.members);
	const leader = team.createdBy;
	return {
		id: team.id, name: team.name, tag: team.tag, leader,
		members: team.members.filter((m) => m.confirmed).map((m) => ({
			id: m.userId, displayName: m.user.displayName, avatarUrl: m.user.avatarUrl,
			isLeader: m.userId === leader.id, isSubstitute: m.isSubstitute
		})),
		roster, locked: isLocked(team), isMember: isMember(team, viewerId), isLeader: leader.id === viewerId,
		cups: team.applications.filter((app) => ACTIVE_APPLICATIONS.includes(app.status as typeof ACTIVE_APPLICATIONS[number]))
			.map((app) => ({ ...app.tournament, applicationStatus: app.status }))
	};
}

export async function getParty(teamId: string, viewerId: string) {
	const team = await prisma.team.findUnique({ where: { id: teamId }, include: teamInclude });
	if (!team || team.deletedAt) throw new DomainError('Пати не найдено.', 404);
	if (!isMember(team, viewerId)) throw new DomainError('Вы не участник этого пати.', 403);
	return partyView(team, viewerId);
}

async function resolveParty(db: Db, userId: string, teamId?: string) {
	// Serialize first invitation from a solo player so two taps cannot create two groups.
	await db.$executeRaw`SELECT id FROM "User" WHERE id = ${userId} FOR UPDATE`;
	if (!teamId) {
		const existing = await db.team.findFirst({
			where: { deletedAt: null, OR: [{ createdById: userId }, { members: { some: { userId, confirmed: true } } }] },
			orderBy: { createdAt: 'desc' }, select: { id: true }
		});
		teamId = existing?.id;
	}
	if (!teamId) {
		const user = await db.user.findUniqueOrThrow({ where: { id: userId }, select: { displayName: true } });
		const team = await db.team.create({ data: {
			name: `Пати ${user.displayName}`.slice(0, 80), game: 'Dota 2', createdById: userId, recruitmentStatus: 'INVITE_ONLY',
			members: { create: { userId, role: 'captain', confirmed: true, confirmedAt: new Date() } }
		} });
		teamId = team.id;
		await db.auditLog.create({ data: { actorId: userId, action: 'PARTY_CREATED', entity: 'Team', entityId: teamId } });
	}
	await lockParty(db, teamId);
	const team = await db.team.findUnique({ where: { id: teamId }, include: teamInclude });
	if (!team || !isMember(team, userId)) throw new DomainError('Выберите своё пати.', 403);
	assertOpen(team);
	const block = inviteRosterBlock(countMainRoster(team.members));
	if (block) throw new DomainError(block, 409);
	return team;
}

async function validateCup(db: Db, tournamentId?: string | null) {
	if (!tournamentId) return null;
	const cup = await db.tournament.findUnique({ where: { id: tournamentId }, select: { id: true, title: true, status: true } });
	if (!cup) throw new DomainError('Кубок не найден.', 404);
	if (!['REGISTRATION', 'CHECK_IN'].includes(cup.status)) throw new DomainError('Набор на этот кубок закрыт.', 409);
	return cup;
}

export async function createPartyInvite(userId: string, input: { teamId?: string; toUserId: string; tournamentId?: string; message?: string; position?: number }) {
	if (input.toUserId === userId) throw new DomainError('Нельзя пригласить себя.');
	return prisma.$transaction(async (db) => {
		const team = await resolveParty(db, userId, input.teamId);
		const target = await db.user.findUnique({ where: { id: input.toUserId }, select: { steamId: true } });
		if (!target?.steamId) throw new DomainError('Игрок со Steam не найден.', 404);
		if (team.members.some((m) => m.userId === input.toUserId && m.confirmed)) throw new DomainError('Игрок уже в пати.', 409);
		const cup = await validateCup(db, input.tournamentId);
		const existing = await db.teamInvite.findFirst({ where: { teamId: team.id, toUserId: input.toUserId, status: 'PENDING' } });
		if (existing && existing.createdAt.getTime() > Date.now() - 7 * 86400000) return { invite: existing, party: partyView(team, userId) };
		if (existing) await db.teamInvite.update({ where: { id: existing.id }, data: { status: 'EXPIRED' } });
		const message = [input.message, input.position ? `Позиция: ${input.position}` : null].filter(Boolean).join(' · ') || null;
		const invite = await db.teamInvite.create({ data: {
			teamId: team.id, fromUserId: userId, toUserId: input.toUserId, role: 'member', message, tournamentId: cup?.id
		} });
		await db.notification.create({ data: {
			userId: input.toUserId, type: 'TEAM_INVITE', title: 'Приглашение в пати',
			body: `${team.name}: ${countMainRoster(team.members).confirmed}/5. Лидер: ${team.createdBy.displayName}.`,
			linkUrl: partySearchHref({ invite: invite.id, teamId: team.id, tournamentId: cup?.id }),
			metadata: { inviteId: invite.id, teamId: team.id, fromUserId: userId, tournamentId: cup?.id ?? null }
		} });
		await db.auditLog.create({ data: { actorId: userId, action: 'TEAM_INVITE_CREATED', entity: 'TeamInvite', entityId: invite.id } });
		return { invite, party: partyView(team, userId) };
	});
}

export async function createPartyLink(userId: string, input: { teamId?: string; tournamentId?: string }) {
	return prisma.$transaction(async (db) => {
		const team = await resolveParty(db, userId, input.teamId);
		await validateCup(db, input.tournamentId);
		const token = generateSessionToken();
		const expiresAt = new Date(Date.now() + 86400000);
		await db.teamJoinLink.create({ data: { tokenHash: hashToken(token), teamId: team.id, fromUserId: userId, tournamentId: input.tournamentId, expiresAt } });
		await db.auditLog.create({ data: { actorId: userId, action: 'PARTY_LINK_CREATED', entity: 'Team', entityId: team.id } });
		return { path: `/party-search?join=${token}`, expiresAt, party: partyView(team, userId) };
	});
}

export async function revokePartyLinks(teamId: string, userId: string) {
	return prisma.$transaction(async (db) => {
		await lockParty(db, teamId);
		const team = await db.team.findUnique({ where: { id: teamId }, include: teamInclude });
		if (!team || team.deletedAt || team.createdById !== userId) throw new DomainError('Ссылки отзывает лидер пати.', 403);
		await db.teamJoinLink.updateMany({ where: { teamId, revokedAt: null }, data: { revokedAt: new Date() } });
		await db.auditLog.create({ data: { actorId: userId, action: 'PARTY_LINKS_REVOKED', entity: 'Team', entityId: teamId } });
	});
}

type InvitationKey = { inviteId: string } | { token: string };
async function invitation(db: Db, key: InvitationKey, userId: string) {
	const entry = 'inviteId' in key
		? await db.teamInvite.findUnique({ where: { id: key.inviteId } })
		: await db.teamJoinLink.findUnique({ where: { tokenHash: hashToken(key.token) } });
	if (!entry) throw new DomainError('Приглашение не найдено.', 404);
	if ('toUserId' in entry && ![entry.toUserId, entry.fromUserId].includes(userId)) throw new DomainError('Это приглашение для другого игрока.', 403);
	const expiresAt = 'expiresAt' in entry ? entry.expiresAt : new Date(entry.createdAt.getTime() + 7 * 86400000);
	const expired = expiresAt.getTime() <= Date.now() || ('revokedAt' in entry && Boolean(entry.revokedAt));
	return { entry, expiresAt, expired };
}

export async function getPartyInvitation(key: InvitationKey, userId: string) {
	const { entry, expiresAt, expired } = await invitation(prisma, key, userId);
	const team = await prisma.team.findUnique({ where: { id: entry.teamId }, include: teamInclude });
	if (!team || team.deletedAt) throw new DomainError('Пати распущено.', 410);
	const fromUser = await prisma.user.findUnique({ where: { id: entry.fromUserId }, select: { id: true, displayName: true } });
	const validSender = isMember(team, entry.fromUserId);
	return {
		id: entry.id, teamId: team.id, fromUser, toUserId: 'toUserId' in entry ? entry.toUserId : null,
		status: expired || !validSender ? 'EXPIRED' : 'status' in entry ? entry.status : 'PENDING',
		expiresAt, party: partyView(team, userId), tournamentId: entry.tournamentId,
		canAccept: !expired && validSender && !isLocked(team) && !countMainRoster(team.members).full &&
			!isMember(team, userId) && (!('toUserId' in entry) || (entry.toUserId === userId && entry.status === 'PENDING'))
	};
}

async function addMember(db: Db, team: PartyTeam, userId: string, invitedById: string, tournamentId?: string | null) {
	assertOpen(team);
	if (!isMember(team, invitedById)) throw new DomainError('Пригласивший игрок больше не в пати.', 410);
	if (isMember(team, userId)) return;
	const block = inviteRosterBlock(countMainRoster(team.members));
	if (block) throw new DomainError(block, 409);
	const cups = new Set(team.applications.filter((app) => ACTIVE_APPLICATIONS.includes(app.status as typeof ACTIVE_APPLICATIONS[number])).map((app) => app.tournamentId));
	if (tournamentId) cups.add(tournamentId);
	const conflict = await db.teamApplication.findFirst({ where: {
		teamId: { not: team.id }, tournamentId: { in: [...cups] }, status: { in: [...ACTIVE_APPLICATIONS] },
		team: { members: { some: { userId, confirmed: true, isSubstitute: false } } }
	}, include: { team: { select: { name: true } } } });
	if (conflict) throw new DomainError(`Вы уже заявлены на этот кубок за «${conflict.team.name}».`, 409);
	await db.teamMember.upsert({
		where: { teamId_userId: { teamId: team.id, userId } },
		create: { teamId: team.id, userId, role: 'member', confirmed: true, confirmedAt: new Date() },
		update: { role: 'member', confirmed: true, confirmedAt: new Date(), isSubstitute: false }
	});
	await db.lfgPost.deleteMany({ where: { userId } });
	await refreshPartyApplications(db, team.id);
	const player = await db.user.findUniqueOrThrow({ where: { id: userId }, select: { displayName: true } });
	await db.notification.createMany({ data: [...new Set([team.createdById, invitedById])].map((recipientId) => ({
		userId: recipientId, type: 'TEAM_INVITE_RESPONSE', title: 'Игрок вступил в пати',
		body: `${player.displayName} в «${team.name}». Сейчас ${countMainRoster(team.members).confirmed + 1}/5.`,
		linkUrl: `/party-search?teamId=${team.id}`, metadata: { teamId: team.id }
	})) });
}

export async function answerPartyInvitation(key: InvitationKey, userId: string, action: 'ACCEPTED' | 'DECLINED') {
	await prisma.$transaction(async (db) => {
		await db.$executeRaw`SELECT id FROM "User" WHERE id = ${userId} FOR UPDATE`;
		const initial = await invitation(db, key, userId);
		await lockParty(db, initial.entry.teamId);
		const { entry, expired } = await invitation(db, key, userId);
		if (expired) throw new DomainError('Приглашение истекло или отозвано.', 410);
		if ('toUserId' in entry && entry.toUserId !== userId) throw new DomainError('Ответить может только приглашённый игрок.', 403);
		if ('status' in entry && entry.status !== 'PENDING') throw new DomainError('Приглашение уже обработано.', 409);
		const team = await db.team.findUnique({ where: { id: entry.teamId }, include: teamInclude });
		if (!team) throw new DomainError('Пати не найдено.', 404);
		if (action === 'ACCEPTED') await addMember(db, team, userId, entry.fromUserId, entry.tournamentId);
		if ('toUserId' in entry) await db.teamInvite.update({ where: { id: entry.id }, data: { status: action, respondedAt: new Date() } });
		await db.auditLog.create({ data: { actorId: userId, action: `TEAM_INVITE_${action}`, entity: 'Team', entityId: team.id, payload: { invitationId: entry.id } } });
	});
	return getPartyInvitation(key, userId);
}

export async function managePartyMember(teamId: string, actorId: string, input: { action: 'leave' | 'kick' | 'substitute' | 'deputy'; userId?: string; isSubstitute?: boolean }) {
	return prisma.$transaction(async (db) => {
		await lockParty(db, teamId);
		const team = await db.team.findUnique({ where: { id: teamId }, include: teamInclude });
		if (!team || team.deletedAt) throw new DomainError('Пати не найдено.', 404);
		const targetId = input.action === 'leave' ? actorId : input.userId;
		if (!targetId) throw new DomainError('Укажите игрока.');
		const target = team.members.find((m) => m.userId === targetId && m.confirmed);
		if (!target) throw new DomainError('Игрок больше не в пати.', 404);
		if (!isMember(team, actorId)) throw new DomainError('Вы больше не в пати.', 403);
		if (input.action !== 'leave' && team.createdById !== actorId) throw new DomainError('Составом управляет только лидер.', 403);
		if (targetId === team.createdById) throw new DomainError('Лидера нельзя исключить, вывести из основы или назначить заместителем.', 400);
		assertOpen(team);
		if (input.action === 'deputy') {
			await db.teamMember.updateMany({ where: { teamId, role: 'deputy' }, data: { role: 'member' } });
			await db.teamMember.update({ where: { id: target.id }, data: { role: 'deputy' } });
		} else if (input.action === 'substitute') {
			if (input.isSubstitute === false && target.isSubstitute && countMainRoster(team.members).full) throw new DomainError('В основе уже пять игроков.', 409);
			await db.teamMember.update({ where: { id: target.id }, data: { isSubstitute: input.isSubstitute ?? true } });
			await refreshPartyApplications(db, teamId);
		} else {
			await db.teamMember.delete({ where: { id: target.id } });
			// Old shared links must not immediately re-admit an excluded member.
			await db.teamJoinLink.updateMany({ where: { teamId, revokedAt: null, ...(input.action === 'leave' ? { fromUserId: targetId } : {}) }, data: { revokedAt: new Date() } });
			await db.teamInvite.updateMany({ where: { teamId, status: 'PENDING', OR: [{ fromUserId: targetId }, { toUserId: targetId }] }, data: { status: 'DECLINED', respondedAt: new Date() } });
			await refreshPartyApplications(db, teamId);
			await db.notification.create({ data: {
				userId: input.action === 'kick' ? targetId : team.createdById, type: 'TEAM_ROSTER_CHANGED',
				title: 'Состав пати изменён', body: `${target.user.displayName} покинул пати «${team.name}».`, linkUrl: '/party-search'
			} });
		}
		await db.auditLog.create({ data: { actorId, action: `PARTY_MEMBER_${input.action.toUpperCase()}`, entity: 'Team', entityId: teamId, payload: { targetUserId: targetId } } });
		return { ok: true };
	});
}
