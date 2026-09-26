import { prisma } from '@/lib/prisma';
import { canPostMatchLobby, canViewMatchLobby, writeMatchLobby } from '@/lib/match-lobby';
import { deputyIdFromMembers } from '@/lib/team-roles';
import { DomainError } from '@/server/errors';
import { isTournamentStaff } from '@/server/tournaments/staff';
import { publishTournamentEvent } from '@/server/realtime/publish';
import type { Role } from '@prisma/client';

async function loadLobbyGate(matchId: string) {
	const match = await prisma.match.findUnique({
		where: { id: matchId },
		include: {
			teamA: {
				select: {
					id: true,
					name: true,
					createdById: true,
					members: { where: { confirmed: true }, select: { userId: true, role: true } }
				}
			},
			teamB: {
				select: {
					id: true,
					name: true,
					createdById: true,
					members: { where: { confirmed: true }, select: { userId: true, role: true } }
				}
			},
			tournament: { select: { id: true, title: true } }
		}
	});
	return match;
}

export async function saveMatchLobby(
	matchId: string,
	actorId: string,
	actorRole: Role,
	input: {
		name: string;
		password?: string | null;
		region?: string | null;
		voiceUrl?: string | null;
		playing?: boolean;
	}
) {
	const match = await loadLobbyGate(matchId);
	if (!match) throw new DomainError('Матч не найден', 404);
	if (['COMPLETED', 'TECHNICAL'].includes(match.status)) {
		throw new DomainError('Пара уже закрыта', 400);
	}
	const staff = await isTournamentStaff(actorId, actorRole, match.tournamentId);
	const deputyA = match.teamA ? deputyIdFromMembers(match.teamA.members, match.teamA.createdById) : null;
	const deputyB = match.teamB ? deputyIdFromMembers(match.teamB.members, match.teamB.createdById) : null;
	if (!canPostMatchLobby(actorId, match.teamA?.createdById, match.teamB?.createdById, staff, deputyA, deputyB)) {
		throw new DomainError('Лобби выкладывает капитан, заместитель или судья', 403);
	}
	if (!match.teamAId || !match.teamBId) {
		throw new DomainError('Пока нет обеих команд, лобби выкладывать рано', 400);
	}
	let lobby;
	try {
		const host =
			match.teamA && (match.teamA.createdById === actorId || deputyA === actorId)
				? match.teamA.name
				: match.teamB && (match.teamB.createdById === actorId || deputyB === actorId)
					? match.teamB.name
					: 'Судья';
		lobby = writeMatchLobby({ ...input, hostName: host });
	} catch {
		throw new DomainError('Укажите имя лобби (минимум 2 символа)', 400);
	}
	if (input.voiceUrl && !lobby.voiceUrl) {
		throw new DomainError('Голосовой — только https-ссылка Discord или Telegram', 400);
	}

	await prisma.match.update({
		where: { id: matchId },
		data: { lobby, startedAt: match.startedAt ?? new Date() }
	});
	await publishTournamentEvent(match.tournament.id, 'lobby_updated', { matchId });

	const memberIds = Array.from(
		new Set(
			[
				match.teamA?.createdById,
				match.teamB?.createdById,
				...(match.teamA?.members.map((row) => row.userId) ?? []),
				...(match.teamB?.members.map((row) => row.userId) ?? [])
			].filter((id): id is string => Boolean(id) && id !== actorId)
		)
	);
	const lobbyTitle = lobby.playing ? `Заходим в катку: ${match.tournament.title}` : `Лобби выложено: ${match.tournament.title}`;
	const lobbyBody = lobby.playing
		? `${lobby.hostName ?? 'Капитан'} пишет: зашли, играем. Лобби «${lobby.name}».`
		: `${lobby.hostName ?? 'Капитан'} выложил лобби «${lobby.name}»${lobby.region ? ` · ${lobby.region}` : ''}${lobby.voiceUrl ? ' · есть голосовой' : ''}. Пароль на карточке турнира.`;
	const lobbyLink = `/tournaments/${match.tournament.id}#match-${matchId}`;
	if (memberIds.length) {
		await prisma.notification.createMany({
			data: memberIds.map((userId) => ({
				userId,
				type: 'MATCH_LOBBY',
				title: lobbyTitle,
				body: lobbyBody,
				linkUrl: lobbyLink
			}))
		});
	}
	const { pingTournamentExternal } = await import('@/server/notify/external');
	await pingTournamentExternal({
		tournamentId: match.tournament.id,
		teamIds: [match.teamAId, match.teamBId].filter((id): id is string => Boolean(id)),
		ping: { title: lobbyTitle, body: lobbyBody, linkUrl: lobbyLink }
	}).catch((error) => console.error('external lobby ping failed', error));
	return lobby;
}

export async function canSeeMatchLobbySecrets(matchId: string, userId: string, role: Role) {
	const match = await loadLobbyGate(matchId);
	if (!match) return false;
	const staff = await isTournamentStaff(userId, role, match.tournamentId);
	const memberIds = [
		match.teamA?.createdById,
		match.teamB?.createdById,
		...(match.teamA?.members.map((row) => row.userId) ?? []),
		...(match.teamB?.members.map((row) => row.userId) ?? [])
	];
	return canViewMatchLobby(userId, memberIds, staff);
}
