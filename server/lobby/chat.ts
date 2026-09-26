import { prisma } from '@/lib/prisma';
import {
	LOBBY_BODY_MAX,
	mentionIds,
	rewriteLobbyMentions,
	sanitizeLobbyBody,
	type LobbyMessageView
} from '@/lib/lobby-chat';
import { signLobbyTicket } from '@/lib/lobby-ticket';
import { DomainError } from '@/server/errors';
import { publishRoom } from '@/server/realtime/publish';

const authorSelect = { id: true, displayName: true, avatarUrl: true } as const;

function toView(row: {
	id: string;
	body: string;
	createdAt: Date;
	user: { id: string; displayName: string; avatarUrl: string | null };
}): LobbyMessageView {
	return {
		id: row.id,
		body: row.body,
		createdAt: row.createdAt.toISOString(),
		author: row.user
	};
}

export async function listLobbyMessages() {
	const rows = await prisma.lobbyMessage.findMany({
		orderBy: { createdAt: 'desc' },
		take: 40,
		select: { id: true, body: true, createdAt: true, user: { select: authorSelect } }
	});
	return rows.reverse().map(toView);
}

export function lobbyTicketFor(user: { id: string; displayName: string; avatarUrl: string | null }) {
	return signLobbyTicket(user, process.env.DOTA_GC_INTERNAL_TOKEN || '');
}

export async function searchLobbyPeople(query: string, exceptId: string) {
	const q = query.trim().slice(0, 24);
	if (q.length < 1) return [];
	return prisma.user.findMany({
		where: {
			steamId: { not: null },
			id: { not: exceptId },
			displayName: { contains: q, mode: 'insensitive' }
		},
		select: authorSelect,
		take: 8,
		orderBy: { displayName: 'asc' }
	});
}

export async function postLobbyMessage(userId: string, raw: string) {
	const body = sanitizeLobbyBody(raw);
	if (!body) throw new DomainError('Пустое сообщение');
	if (body.length > LOBBY_BODY_MAX) throw new DomainError('Слишком длинное сообщение');

	const author = await prisma.user.findUnique({
		where: { id: userId },
		select: { ...authorSelect, steamId: true }
	});
	if (!author?.steamId) throw new DomainError('Нужен вход через Steam', 403);

	const ids = mentionIds(body).filter((id) => id !== userId);
	const people = ids.length
		? await prisma.user.findMany({
				where: { id: { in: ids }, steamId: { not: null } },
				select: { id: true, displayName: true }
			})
		: [];
	const names = new Map(people.map((person) => [person.id, person.displayName]));
	const stored = rewriteLobbyMentions(body, names);
	const mentioned = mentionIds(stored);

	const row = await prisma.lobbyMessage.create({
		data: { userId, body: stored },
		select: { id: true, body: true, createdAt: true, user: { select: authorSelect } }
	});
	const view = toView(row);

	if (mentioned.length) {
		await prisma.notification.createMany({
			data: mentioned.map((id) => ({
				userId: id,
				type: 'LOBBY_MENTION',
				title: 'Сообщение для вас',
				body: `${author.displayName} отметил вас в чате арены`,
				linkUrl: '/home#lobby-chat',
				metadata: { messageId: row.id, fromUserId: author.id }
			}))
		});
	}
	await prisma.auditLog.create({
		data: {
			actorId: userId,
			action: 'LOBBY_MESSAGE',
			entity: 'LobbyMessage',
			entityId: row.id,
			payload: { mentions: mentioned }
		}
	});

	await publishRoom('lobby:chat', 'lobby:message', view);
	for (const id of mentioned) {
		await publishRoom(`user:${id}`, 'lobby:mention', {
			messageId: row.id,
			fromName: author.displayName
		});
	}
	return view;
}
