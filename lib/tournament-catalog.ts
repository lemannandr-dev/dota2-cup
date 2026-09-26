import { cupCardTitle, isCupDryRun, isCupShowcase } from '@/lib/cup-label';
import type { RosterSlotPlayer } from '@/lib/team-roster';
import { publicPrizeCaption, type LandingPrizeKind } from '@/lib/landing-live';
import { applicationStatusLabel, formatCopy, tournamentStatusCopy } from '@/lib/tournament-copy';

const OUT_APP = new Set(['REJECTED', 'WITHDRAWN', 'DISQUALIFIED', 'NO_CHECK_IN']);
const CLOSED_MATCH = new Set(['COMPLETED', 'TECHNICAL']);
const STATUS_ORDER: Record<string, number> = {
	LIVE: 0,
	CHECK_IN: 1,
	REGISTRATION: 2,
	DRAFT: 3,
	FINISHED: 4,
	CANCELLED: 5
};

export type CatalogMatch = {
	status: string;
	winnerTeamId?: string | null;
	scoreA: number;
	scoreB: number;
	bestOf: number;
	teamA?: { name: string } | null;
	teamB?: { name: string } | null;
};

export type CatalogFeaturedPair = {
	teamA: string;
	teamB: string;
	scoreA: number;
	scoreB: number;
	bestOf: number;
	live: boolean;
};

export type CatalogPrizeLine = {
	kind: LandingPrizeKind;
	label: string;
	short: string;
};

export function catalogActiveTeamCount(applications: Array<{ status: string }>) {
	return applications.filter((row) => !OUT_APP.has(row.status)).length;
}

export function catalogOpenMatches<T extends { status: string; winnerTeamId?: string | null }>(matches: T[]) {
	return matches.filter((match) => !CLOSED_MATCH.has(match.status) && !match.winnerTeamId);
}

export function catalogLiveMatchCount(matches: Array<{ status: string }>) {
	return matches.filter((match) => match.status === 'LIVE').length;
}

export function catalogFeaturedPair(matches: CatalogMatch[]): CatalogFeaturedPair | null {
	const open = catalogOpenMatches(matches);
	const ranked = [...open].sort((left, right) => {
		const rank = (status: string) => (status === 'LIVE' ? 0 : status === 'NEEDS_REVIEW' ? 1 : 2);
		return rank(left.status) - rank(right.status);
	});
	const match = ranked.find((row) => row.teamA && row.teamB) ?? ranked[0];
	if (!match) return null;
	return {
		teamA: match.teamA?.name ?? 'TBD',
		teamB: match.teamB?.name ?? 'TBD',
		scoreA: match.scoreA,
		scoreB: match.scoreB,
		bestOf: match.bestOf,
		live: match.status === 'LIVE'
	};
}

export function catalogPrizeLine(prizeStatus: string, prizePool: number, currency = 'RUB'): CatalogPrizeLine {
	const caption = publicPrizeCaption(prizeStatus, prizePool, currency);
	return { kind: caption.kind, label: caption.label, short: caption.label };
}

export function catalogNextHint(input: {
	status: string;
	teams: number;
	maxTeams: number;
	openMatches: number;
	liveMatches: number;
	championName?: string | null;
}) {
	if (input.status === 'CANCELLED') return 'Турнир отменён';
	if (input.status === 'FINISHED') return input.championName ? `Чемпион · ${input.championName}` : 'Кубок закрыт';
	if (input.status === 'REGISTRATION') {
		const left = Math.max(0, input.maxTeams - input.teams);
		return left > 0 ? `Приём заявок · свободно ${left}` : 'Слоты заняты · ждём отметку';
	}
	if (input.status === 'CHECK_IN') return 'Капитаны отмечают состав';
	if (input.status === 'LIVE') {
		if (input.liveMatches > 0) return input.liveMatches === 1 ? 'Идёт 1 живая пара' : `Идут ${input.liveMatches} живые пары`;
		if (input.openMatches > 0) return `Открытых пар: ${input.openMatches}`;
		return 'Сетка есть · пары ещё не начались';
	}
	if (input.status === 'DRAFT') return 'Черновик · виден только оргу';
	return 'Откройте карточку кубка';
}

export function catalogCtaLabel(status: string) {
	if (status === 'REGISTRATION') return 'К заявке';
	if (status === 'CHECK_IN') return 'К отметке';
	if (status === 'LIVE') return 'К сетке';
	if (status === 'FINISHED') return 'Итог';
	return 'Открыть';
}

export function catalogStatusRank(status: string) {
	return STATUS_ORDER[status] ?? 9;
}

export function sortCatalogTournaments<T extends { status: string; startAt: string }>(rows: T[]) {
	return [...rows].sort((left, right) => {
		const byStatus = catalogStatusRank(left.status) - catalogStatusRank(right.status);
		if (byStatus !== 0) return byStatus;
		return Date.parse(left.startAt) - Date.parse(right.startAt);
	});
}

export function catalogMetaLine(input: { format: string; seriesRules: string; region?: string | null; rankCap?: string | null }) {
	const bits = [formatCopy[input.format] ?? input.format, input.seriesRules, input.region?.trim() || null, input.rankCap?.trim() ? `до ${input.rankCap.trim()}` : null].filter(Boolean);
	return bits.join(' · ');
}

export function catalogDisplayTitle(title: string) {
	return cupCardTitle(title);
}

export function catalogStatusLabel(status: string) {
	return tournamentStatusCopy[status]?.label ?? status;
}

export type CatalogFilter = 'ALL' | 'AVAILABLE' | 'MINE' | 'LIVE' | 'REGISTRATION' | 'CHECK_IN' | 'FINISHED';

export type CatalogFacetFilter = {
	region: string;
	date: 'ANY' | 'TODAY' | 'WEEK' | 'LATER';
	rank: 'ANY' | 'CAPPED' | 'OPEN';
};

export type CatalogMine = {
	teamId: string;
	teamName: string;
	applicationStatus: string;
	isCaptain: boolean;
	extraTeams: number;
	hint: string;
	withSteam: number;
	needed: number;
	members: RosterSlotPlayer[];
};

export type CatalogCup = {
	id: string;
	title: string;
	href: string;
	format: string;
	status: string;
	maxTeams: number;
	seriesRules: string;
	region: string | null;
	rankCap: string | null;
	prizePool: number;
	prizeCurrency: string;
	prizeStatus: string;
	aegisAward: string;
	inviteOnly: boolean;
	startAt: string;
	startAtLabel: string;
	teams: number;
	openMatches: number;
	liveMatches: number;
	pair: CatalogFeaturedPair | null;
	championName: string | null;
	dryRun: boolean;
	showcase: boolean;
	mine: CatalogMine | null;
};

const OUT_MY = new Set(['REJECTED', 'WITHDRAWN', 'DISQUALIFIED', 'NO_CHECK_IN']);

export function isCatalogQuiet(row: { status: string; title?: string; dryRun?: boolean; showcase?: boolean }) {
	if (row.status === 'LIVE' || row.status === 'CHECK_IN' || row.status === 'REGISTRATION' || row.status === 'DRAFT') return false;
	if (row.status === 'FINISHED' || row.status === 'CANCELLED') return true;
	return Boolean(row.dryRun || row.showcase || (row.title && (isCupDryRun(row.title) || isCupShowcase(row.title))));
}

export function catalogMatchesFilter(
	row: { status: string; title?: string; dryRun?: boolean; showcase?: boolean; mine?: unknown },
	filter: CatalogFilter
) {
	if (filter === 'ALL') return true;
	if (filter === 'AVAILABLE') return row.status === 'REGISTRATION';
	if (filter === 'MINE') return Boolean(row.mine);
	if (filter === 'LIVE') return row.status === 'LIVE';
	if (filter === 'REGISTRATION') return row.status === 'REGISTRATION';
	if (filter === 'CHECK_IN') return row.status === 'CHECK_IN';
	if (filter === 'FINISHED') return row.status === 'FINISHED' || row.status === 'CANCELLED' || isCatalogQuiet(row);
	return true;
}

export function catalogMatchesFacets(
	row: Pick<CatalogCup, 'region' | 'rankCap' | 'startAt'>,
	filter: CatalogFacetFilter,
	now = new Date()
) {
	if (filter.region !== 'ALL' && (row.region?.trim() || 'Без региона') !== filter.region) return false;
	if (filter.rank === 'CAPPED' && !row.rankCap?.trim()) return false;
	if (filter.rank === 'OPEN' && row.rankCap?.trim()) return false;
	if (filter.date === 'ANY') return true;

	const start = new Date(row.startAt);
	if (Number.isNaN(start.getTime())) return false;
	const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
	const tomorrow = new Date(today);
	tomorrow.setDate(tomorrow.getDate() + 1);
	const weekEnd = new Date(today);
	weekEnd.setDate(weekEnd.getDate() + 7);
	if (filter.date === 'TODAY') return start >= today && start < tomorrow;
	if (filter.date === 'WEEK') return start >= today && start < weekEnd;
	return start >= weekEnd;
}

export function splitCatalogCups<T extends { status: string; startAt: string; title?: string; dryRun?: boolean; showcase?: boolean }>(rows: T[]) {
	const active: T[] = [];
	const quiet: T[] = [];
	for (const row of rows) {
		if (isCatalogQuiet(row)) quiet.push(row);
		else active.push(row);
	}
	return { active: sortCatalogTournaments(active), quiet: sortCatalogTournaments(quiet) };
}

export function catalogMyHint(input: { teamName: string; applicationStatus: string; cupStatus: string; isCaptain: boolean; extraTeams?: number }) {
	const team = `«${input.teamName}»`;
	let hint: string;
	if (OUT_MY.has(input.applicationStatus)) {
		hint = `${team} вне турнира · ${applicationStatusLabel(input.applicationStatus)}`;
	} else if (input.cupStatus === 'CHECK_IN') {
		hint = input.isCaptain ? `Отметить состав ${team}` : `Ждём капитана ${team}`;
	} else if (input.applicationStatus === 'SUBMITTED' || input.applicationStatus === 'NEEDS_ACTION') {
		hint = `${team} · ${applicationStatusLabel(input.applicationStatus)}`;
	} else if (input.cupStatus === 'LIVE') {
		hint = `${team} в сетке`;
	} else if (input.cupStatus === 'FINISHED') {
		hint = `${team} сыграла`;
	} else {
		hint = `${team} · ${applicationStatusLabel(input.applicationStatus)}`;
	}
	if (input.extraTeams && input.extraTeams > 0) hint += ` · ещё ${input.extraTeams} ваших команд`;
	return hint;
}

const MINE_RANK: Record<string, number> = {
	IN_BRACKET: 0,
	CHECKED_IN: 1,
	APPROVED: 2,
	NEEDS_ACTION: 3,
	SUBMITTED: 4,
	WAITLIST: 5
};

export function pickCatalogMine<T extends { status: string; team: { members: unknown[] } }>(applications: T[]): T | null {
	const mine = applications.filter((row) => row.team.members.length > 0);
	if (!mine.length) return null;
	return [...mine].sort((left, right) => (MINE_RANK[left.status] ?? 9) - (MINE_RANK[right.status] ?? 9))[0] ?? null;
}
