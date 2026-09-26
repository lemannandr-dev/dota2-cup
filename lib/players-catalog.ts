import { formatStoredArenaRating } from '@/lib/arena-rating';
import { medalCaption, storedMedalOf, storedOpenDotaMmr, type HeaderRankMedal, type OpenDotaMmr } from '@/lib/dota-rank';
import { isRecentlyOnline } from '@/lib/presence';
import { playerCardHref } from '@/lib/site';
import { applicationStatusLabel } from '@/lib/tournament-copy';
import { partySearchHref } from '@/lib/team-roster';

export const PLAYER_OUT_APP = new Set(['REJECTED', 'WITHDRAWN', 'DISQUALIFIED', 'NO_CHECK_IN']);

export type CatalogPlayerCup = {
	tournamentId: string;
	href: string;
	year: number;
	title: string;
	engraving: string;
	winnerTeamName: string;
	description: string;
	showcase: boolean;
	dryRun: boolean;
};

export function slimCatalogCup(cup: {
	tournamentId: string;
	href: string;
	year: number;
	title: string;
	engraving: string;
	winnerTeamName: string;
	showcase: boolean;
	dryRun: boolean;
	trophy?: { description?: string | null };
}): CatalogPlayerCup {
	return {
		tournamentId: cup.tournamentId,
		href: cup.href,
		year: cup.year,
		title: cup.title,
		engraving: cup.engraving,
		winnerTeamName: cup.winnerTeamName,
		description: cup.trophy?.description?.trim() || `Чемпионы «${cup.winnerTeamName}».`,
		showcase: cup.showcase,
		dryRun: cup.dryRun
	};
}

export function catalogCupKind(cup: Pick<CatalogPlayerCup, 'showcase' | 'dryRun'>) {
	if (cup.showcase) return 'Витрина';
	if (cup.dryRun) return 'Прогон';
	return 'Чемпион';
}

export type CatalogPlayerTeam = {
	id: string;
	name: string;
	roleLabel: string;
	withSteam: number;
	needed: number;
	extraTeams: number;
};

export type CatalogPlayerLfg = {
	id: string;
	note: string | null;
	roles: number[];
	cupTitle: string | null;
};

export type CatalogPlayerOpenCup = {
	id: string;
	title: string;
	href: string;
	status: string;
	applicationStatus: string;
	hint: string;
};

export type CatalogPlayer = {
	id: string;
	href: string;
	displayName: string;
	username: string | null;
	steamId: string | null;
	avatarUrl: string | null;
	rating: number;
	ratingGames: number;
	lastLoginAt: string | null;
	online: boolean;
	medal: HeaderRankMedal | null;
	mmr: OpenDotaMmr | null;
	team: CatalogPlayerTeam | null;
	lfg: CatalogPlayerLfg | null;
	openCup: CatalogPlayerOpenCup | null;
	championships: CatalogPlayerCup[];
};

export type CatalogViewer = {
	id: string | null;
	canInvite: boolean;
	inviteTeamId: string | null;
};

export type PlayersFilter = 'ALL' | 'ONLINE' | 'RATED' | 'STEAM' | 'LFG' | 'CHAMPS';

export type CatalogPlayerInput = {
	id: string;
	displayName: string;
	username?: string | null;
	steamId?: string | null;
	avatarUrl?: string | null;
	rating: number;
	ratingGames?: number | null;
	lastLoginAt?: Date | string | null;
	openDotaRankTier?: number | null;
	openDotaLeaderboard?: number | null;
	openDotaMmr?: number | null;
	openDotaMmrSource?: string | null;
};

export function catalogTeamRoleLabel(input: { isSubstitute?: boolean; isCaptain?: boolean }) {
	if (input.isSubstitute) return 'запасной';
	if (input.isCaptain) return 'капитан';
	return 'в пятёрке';
}

export function pickCatalogPlayerTeam<
	T extends {
		userId: string;
		role: string;
		isSubstitute: boolean;
		team: {
			id: string;
			createdById: string;
			name?: string;
			applications?: Array<{ status: string; tournament: { status: string } }>;
			members?: Array<{ confirmed?: boolean; isSubstitute?: boolean; user?: { steamId?: string | null } }>;
		};
	}
>(rows: T[], userId: string): T | null {
	const mine = rows.filter((row) => row.userId === userId);
	if (!mine.length) return null;
	return [...mine].sort((left, right) => {
		const rank = (row: T) => {
			const open = pickCatalogOpenCup(row.team.applications ?? []);
			const cup = open ? (open.tournament.status === 'LIVE' ? 0 : open.tournament.status === 'CHECK_IN' ? 1 : 2) : 4;
			const seat =
				row.team.createdById === userId || row.role === 'captain' ? (row.isSubstitute ? 1 : 0) : row.isSubstitute ? 3 : 2;
			const steam = (row.team.members ?? []).filter((member) => member.confirmed && !member.isSubstitute && member.user?.steamId).length;
			return cup * 100 + seat * 10 - steam;
		};
		const byRank = rank(left) - rank(right);
		if (byRank !== 0) return byRank;
		return (left.team.name ?? left.team.id).localeCompare(right.team.name ?? right.team.id, 'ru');
	})[0] ?? null;
}

export function mapCatalogPlayer(
	user: CatalogPlayerInput,
	extras: {
		team?: CatalogPlayerTeam | null;
		lfg?: CatalogPlayerLfg | null;
		openCup?: CatalogPlayerOpenCup | null;
		championships?: CatalogPlayerCup[];
	} = {},
	now = Date.now()
): CatalogPlayer {
	return {
		id: user.id,
		href: playerCardHref(user.id),
		displayName: user.displayName,
		username: user.username ?? null,
		steamId: user.steamId ?? null,
		avatarUrl: user.avatarUrl ?? null,
		rating: user.rating,
		ratingGames: user.ratingGames ?? 0,
		lastLoginAt: user.lastLoginAt ? new Date(user.lastLoginAt).toISOString() : null,
		online: isRecentlyOnline(user.lastLoginAt, now),
		medal: storedMedalOf(user),
		mmr: storedOpenDotaMmr(user.openDotaMmr, user.openDotaMmrSource),
		team: extras.team ?? null,
		lfg: extras.lfg ?? null,
		openCup: extras.openCup ?? null,
		championships: extras.championships ?? []
	};
}

export function sortCatalogPlayers<T extends { online: boolean; lastLoginAt: string | null; ratingGames: number; displayName: string }>(
	rows: T[]
) {
	return [...rows].sort((left, right) => {
		if (left.online !== right.online) return left.online ? -1 : 1;
		if (left.ratingGames !== right.ratingGames) return right.ratingGames - left.ratingGames;
		const leftAt = Date.parse(left.lastLoginAt ?? '') || 0;
		const rightAt = Date.parse(right.lastLoginAt ?? '') || 0;
		if (leftAt !== rightAt) return rightAt - leftAt;
		return left.displayName.localeCompare(right.displayName, 'ru');
	});
}

export function catalogMatchesFilter(player: Pick<CatalogPlayer, 'online' | 'ratingGames' | 'steamId' | 'lfg' | 'championships'>, filter: PlayersFilter) {
	if (filter === 'ALL') return true;
	if (filter === 'ONLINE') return player.online;
	if (filter === 'RATED') return player.ratingGames > 0;
	if (filter === 'STEAM') return Boolean(player.steamId);
	if (filter === 'LFG') return Boolean(player.lfg);
	if (filter === 'CHAMPS') return (player.championships?.length ?? 0) > 0;
	return true;
}

export function catalogPlayerLine(player: Pick<CatalogPlayer, 'mmr' | 'medal' | 'steamId' | 'rating' | 'ratingGames'>) {
	const rank = player.mmr
		? `MMR ${player.mmr.value}`
		: player.medal
			? medalCaption(player.medal)
			: player.steamId
				? 'без MMR'
				: 'нет Steam';
	return `${rank} · арена ${formatStoredArenaRating(player.rating, player.ratingGames)}`;
}

export function catalogInviteHint(input: { isSelf: boolean; canInvite: boolean; steamId?: string | null }) {
	if (input.isSelf) return 'Это ваша визитка';
	if (!input.steamId) return 'Без Steam в пятёрку не пригласить';
	if (!input.canInvite) return 'Сначала своя пятёрка';
	return 'В состав команды, не вызов и не +16/−12';
}

export function catalogInviteHref(input: {
	playerId: string;
	displayName: string;
	viewer: CatalogViewer;
	isSelf?: boolean;
	steamId?: string | null;
}) {
	if (input.isSelf || !input.steamId || !input.viewer.canInvite) return null;
	return partySearchHref({
		tab: 'players',
		teamId: input.viewer.inviteTeamId,
		playerId: input.playerId,
		q: input.displayName
	});
}

export function catalogOpenCupHint(input: { teamName: string; applicationStatus: string; cupStatus: string; cupTitle: string }) {
	if (PLAYER_OUT_APP.has(input.applicationStatus)) {
		return `«${input.teamName}» вне «${input.cupTitle}» · ${applicationStatusLabel(input.applicationStatus)}`;
	}
	if (input.cupStatus === 'LIVE') return `«${input.teamName}» в сетке «${input.cupTitle}»`;
	if (input.cupStatus === 'CHECK_IN') return `«${input.teamName}» на отметке «${input.cupTitle}»`;
	return `«${input.teamName}» · ${applicationStatusLabel(input.applicationStatus)} · ${input.cupTitle}`;
}

export function catalogLfgLine(lfg: CatalogPlayerLfg) {
	const roles = lfg.roles.length ? `роли ${lfg.roles.join(', ')}` : 'ищет пати';
	if (lfg.note?.trim()) return `${lfg.note.trim()} · ${roles}`;
	if (lfg.cupTitle) return `ищет пати на ${lfg.cupTitle} · ${roles}`;
	return `ищет пати · ${roles}`;
}

const OPEN_CUP_RANK: Record<string, number> = {
	IN_BRACKET: 0,
	CHECKED_IN: 1,
	APPROVED: 2,
	NEEDS_ACTION: 3,
	SUBMITTED: 4,
	WAITLIST: 5
};

export function pickCatalogOpenCup<T extends { status: string; tournament: { status: string } }>(applications: T[]): T | null {
	const open = applications.filter(
		(row) => !PLAYER_OUT_APP.has(row.status) && ['REGISTRATION', 'CHECK_IN', 'LIVE'].includes(row.tournament.status)
	);
	if (!open.length) return null;
	return [...open].sort((left, right) => (OPEN_CUP_RANK[left.status] ?? 9) - (OPEN_CUP_RANK[right.status] ?? 9))[0] ?? null;
}
