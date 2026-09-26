import { medalCaption, storedMedalOf, storedOpenDotaMmr, type HeaderRankMedal, type OpenDotaMmr } from '@/lib/dota-rank';
import { isRecentlyOnline } from '@/lib/presence';

export type PartyPlayer = {
	id: string;
	displayName: string;
	username: string | null;
	steamId: string | null;
	rating: number;
	ratingGames?: number;
	level: number;
	avatarUrl: string | null;
	lastLoginAt: string | null;
	isOnline: boolean;
	medal: HeaderRankMedal | null;
	mmr: OpenDotaMmr | null;
};

export type PartyLfgCup = {
	id: string;
	title: string;
	href: string;
};

export type PartyOpenCup = {
	id: string;
	title: string;
	status: string;
};

export function isLfgCupOpen(status: string) {
	return status === 'REGISTRATION' || status === 'CHECK_IN' || status === 'LIVE';
}

export type PartyLfgCard = {
	id: string;
	roles: number[];
	mmrMin: number | null;
	mmrMax: number | null;
	note: string | null;
	expiresAt: string;
	createdAt: string;
	rankLabel: string | null;
	medal: HeaderRankMedal | null;
	mmr: OpenDotaMmr | null;
	isOnline: boolean;
	tournament: PartyLfgCup | null;
	user: {
		id: string;
		displayName: string;
		avatarUrl: string | null;
		steamId: string | null;
		rating: number;
		ratingGames?: number;
		level: number;
	};
};

type ArenaUser = {
	id: string;
	displayName: string;
	username?: string | null;
	steamId?: string | null;
	rating: number;
	ratingGames?: number | null;
	level: number;
	avatarUrl?: string | null;
	lastLoginAt?: Date | string | null;
	openDotaRankTier?: number | null;
	openDotaLeaderboard?: number | null;
	openDotaMmr?: number | null;
	openDotaMmrSource?: string | null;
};

export function mapArenaPlayer(user: ArenaUser, now = Date.now()): PartyPlayer {
	return {
		id: user.id,
		displayName: user.displayName,
		username: user.username ?? null,
		steamId: user.steamId ?? null,
		rating: user.rating,
		ratingGames: user.ratingGames ?? 0,
		level: user.level,
		avatarUrl: user.avatarUrl ?? null,
		lastLoginAt: user.lastLoginAt ? new Date(user.lastLoginAt).toISOString() : null,
		isOnline: isRecentlyOnline(user.lastLoginAt, now),
		medal: storedMedalOf(user),
		mmr: storedOpenDotaMmr(user.openDotaMmr, user.openDotaMmrSource)
	};
}

export function sortPartyLfg<T extends { user: { id: string }; createdAt?: string }>(posts: T[], userId?: string | null) {
	return [...posts].sort((left, right) => {
		if (userId) {
			if (left.user.id === userId && right.user.id !== userId) return -1;
			if (right.user.id === userId && left.user.id !== userId) return 1;
		}
		return Date.parse(right.createdAt ?? '') - Date.parse(left.createdAt ?? '');
	});
}

export function lfgCardFromRow(
	post: Parameters<typeof mapLfgCard>[0] & { user: ArenaUser },
	now = Date.now()
): PartyLfgCard {
	return mapLfgCard(
		{
			...post,
			medal: post.medal ?? storedMedalOf(post.user),
			mmr: post.mmr ?? storedOpenDotaMmr(post.user.openDotaMmr, post.user.openDotaMmrSource)
		},
		now
	);
}

export function mapLfgCard(
	post: {
		id: string;
		roles: number[];
		mmrMin: number | null;
		mmrMax: number | null;
		note: string | null;
		expiresAt: Date | string;
		createdAt: Date | string;
		tournamentId?: string | null;
		tournament?: { id: string; title: string } | null;
		medal?: HeaderRankMedal | null;
		mmr?: OpenDotaMmr | null;
		user: ArenaUser;
	},
	now = Date.now()
): PartyLfgCard {
	const player = mapArenaPlayer(post.user, now);
	const cup = post.tournament ?? (post.tournamentId ? { id: post.tournamentId, title: '' } : null);
	return {
		id: post.id,
		roles: post.roles,
		mmrMin: post.mmrMin,
		mmrMax: post.mmrMax,
		note: post.note,
		expiresAt: new Date(post.expiresAt).toISOString(),
		createdAt: new Date(post.createdAt).toISOString(),
		rankLabel: post.medal ? medalCaption(post.medal) : null,
		medal: post.medal ?? null,
		mmr: post.mmr ?? null,
		isOnline: player.isOnline,
		tournament: cup?.id
			? { id: cup.id, title: cup.title || 'Кубок', href: `/tournaments/${cup.id}` }
			: null,
		user: {
			id: player.id,
			displayName: player.displayName,
			avatarUrl: player.avatarUrl,
			steamId: player.steamId,
			rating: player.rating,
			ratingGames: player.ratingGames,
			level: player.level
		}
	};
}
