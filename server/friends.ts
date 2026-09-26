import { prisma } from '@/lib/prisma';
import { bondSets, type FriendBond } from '@/lib/friends';
import { DomainError } from '@/server/errors';

export async function listFriendBonds(userId: string) {
	const rows = await prisma.friendship.findMany({
		where: { OR: [{ requesterId: userId }, { addresseeId: userId }] },
		select: { requesterId: true, addresseeId: true, status: true }
	});
	return bondSets(rows, userId);
}

export async function requestOrAcceptFriend(me: string, them: string) {
	if (me === them) throw new DomainError('Себя в друзья добавить нельзя');
	const target = await prisma.user.findUnique({ where: { id: them }, select: { id: true, displayName: true } });
	if (!target) throw new DomainError('Игрок не найден', 404);

	const existing = await prisma.friendship.findFirst({
		where: {
			OR: [
				{ requesterId: me, addresseeId: them },
				{ requesterId: them, addresseeId: me }
			]
		}
	});

	if (existing?.status === 'ACCEPTED') return { status: 'friends' as const };
	if (existing?.status === 'PENDING' && existing.requesterId === me) return { status: 'outgoing' as const };

	if (existing?.status === 'PENDING' && existing.addresseeId === me) {
		await prisma.friendship.update({ where: { id: existing.id }, data: { status: 'ACCEPTED' } });
		await prisma.notification.create({
			data: {
				userId: existing.requesterId,
				type: 'FRIEND_ACCEPTED',
				title: 'Запрос в друзья принят',
				body: 'Игрок принял ваш запрос.',
				linkUrl: '/teams'
			}
		});
		await prisma.auditLog.create({
			data: { actorId: me, action: 'FRIEND_ACCEPTED', entity: 'Friendship', entityId: existing.id }
		});
		return { status: 'friends' as const };
	}

	const row = existing
		? await prisma.friendship.update({
				where: { id: existing.id },
				data: { requesterId: me, addresseeId: them, status: 'PENDING' }
			})
		: await prisma.friendship.create({ data: { requesterId: me, addresseeId: them, status: 'PENDING' } });

	await prisma.notification.create({
		data: {
			userId: them,
			type: 'FRIEND_REQUEST',
			title: 'Запрос в друзья',
			body: 'Игрок хочет добавить вас в друзья.',
			linkUrl: '/teams'
		}
	});
	await prisma.auditLog.create({
		data: { actorId: me, action: 'FRIEND_REQUEST', entity: 'Friendship', entityId: row.id, payload: { addresseeId: them } }
	});
	return { status: 'outgoing' as const };
}

export type { FriendBond };
