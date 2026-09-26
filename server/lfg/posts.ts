import { prisma } from '@/lib/prisma';
import { DomainError } from '@/server/errors';

import { isLfgCupOpen } from '@/lib/party-search';

export type LfgInput = {
	roles: number[];
	mmrMin?: number;
	mmrMax?: number;
	windowFrom?: Date | null;
	windowTo?: Date | null;
	note?: string;
	expiresAt?: Date;
	tournamentId?: string | null;
};

export async function listActiveLfg(now = new Date()) {
	return prisma.lfgPost.findMany({
		where: { expiresAt: { gt: now } },
		orderBy: { createdAt: 'desc' },
		take: 80,
		include: {
			tournament: { select: { id: true, title: true, status: true } },
			user: {
				select: {
					id: true,
					displayName: true,
					avatarUrl: true,
					steamId: true,
					rating: true,
					ratingGames: true,
					level: true,
					lastLoginAt: true,
					openDotaRankTier: true,
					openDotaLeaderboard: true,
					openDotaMmr: true,
					openDotaMmrSource: true
				}
			}
		}
	});
}

export async function upsertLfgPost(userId: string, input: LfgInput) {
	const roles = input.roles.filter((role) => role >= 1 && role <= 5);
	if (!roles.length) throw new DomainError('Укажите хотя бы одну роль 1–5', 400);
	const expiresAt = input.expiresAt ?? new Date(Date.now() + 6 * 60 * 60 * 1000);

	const tournamentId: string | null = input.tournamentId ?? null;
	if (tournamentId) {
		const cup = await prisma.tournament.findUnique({
			where: { id: tournamentId },
			select: { id: true, status: true }
		});
		if (!cup || !isLfgCupOpen(cup.status)) {
			throw new DomainError('К этому кубку уже нельзя привязать заявку. Выберите открытый турнир или оставьте без кубка.', 400);
		}
	}

	const existing = await prisma.lfgPost.findFirst({
		where: { userId, expiresAt: { gt: new Date() } }
	});
	const data = {
		roles,
		mmrMin: input.mmrMin,
		mmrMax: input.mmrMax,
		windowFrom: input.windowFrom ?? null,
		windowTo: input.windowTo ?? null,
		note: input.note,
		tournamentId,
		expiresAt
	};
	if (existing) {
		return prisma.lfgPost.update({ where: { id: existing.id }, data });
	}
	return prisma.lfgPost.create({ data: { userId, ...data } });
}

export async function closeLfgPost(userId: string) {
	await prisma.lfgPost.updateMany({
		where: { userId, expiresAt: { gt: new Date() } },
		data: { expiresAt: new Date() }
	});
}
