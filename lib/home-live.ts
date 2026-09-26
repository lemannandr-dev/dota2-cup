import type { RosterSlotPlayer } from '@/lib/team-roster';
import { landingPrizeKind, publicPrizeCaption } from '@/lib/landing-live';
import type { MatchDayAction, MatchDayActionCode, MatchDayStep } from '@/lib/match-day';
import type { MatchRecap } from '@/lib/match-recap';
import { formatPrizeAmount } from '@/lib/prize-places';
import { applicationStatusLabel, tournamentStatusLabel } from '@/lib/tournament-copy';

export type HomeLiveCard = {
	id: string;
	tournamentId: string;
	title: string;
	href: string;
	startAt: string;
	startLabel: string;
	teamName: string;
	teamLogo?: string | null;
	teamA: { id: string; name: string; logo?: string | null } | null;
	teamB: { id: string; name: string; logo?: string | null } | null;
	scoreA: number;
	scoreB: number;
	bestOf: number;
	matchId: string | null;
	matchStatus: string | null;
	tournamentStatus: string;
	applicationStatus: string;
	action: MatchDayAction;
	checklist?: MatchDayStep[];
	channels: string[];
	roster: string[];
	isCaptain: boolean;
	opponentName: string | null;
	opponentLogo?: string | null;
	lobbyName: string | null;
	lobbyPassword: string | null;
	lobbyRegion: string | null;
	lobbyVoice: string | null;
	lobbyPlaying: boolean;
	recap: MatchRecap | null;
	reportDeadlineLabel?: string | null;
	checkInClosesAt?: string | null;
	checkInClosesLabel?: string | null;
	isDeputy?: boolean;
	isSubstitute?: boolean;
	benchNote?: string | null;
	prizePool?: number;
	prizeStatus?: string;
	prizeCurrency?: string | null;
};

export type RosterGap = {
	teamId: string;
	teamName: string;
	confirmed: number;
	withSteam: number;
	needed: number;
	readyToApply?: boolean;
	tournamentId?: string | null;
	tournamentTitle?: string | null;
	withoutSteam?: string[];
	vacant?: number;
};

export type HomeTeamMember = RosterSlotPlayer;

export type HomeTeamCard = {
	id: string;
	name: string;
	withSteam: number;
	needed: number;
	members: HomeTeamMember[];
	roleLabel?: string | null;
};

export type HomeOpenCup = {
	id: string;
	title: string;
	href: string;
	status: string;
	startAt: string;
	startLabel: string;
};

export type HomeArenaPlayer = {
	id: string;
	displayName: string;
	avatarUrl: string | null;
	href: string;
};

export type HomeChampion = {
	tournamentId: string;
	title: string;
	href: string;
	teamName: string;
	prizeLabel: string;
};

export type HomePulseCup = {
	id: string;
	title: string;
	href: string;
	statusLabel: string;
	prizeLabel: string;
	teamsLabel: string;
};

export type HomeArenaPulse = {
	live: number;
	registration: number;
	checkIn: number;
	liveMatches: number;
	escrowLabel: string;
	champions: HomeChampion[];
	fundCups: HomePulseCup[];
	gathering: HomePulseCup[];
};

export const EMPTY_ARENA_PULSE: HomeArenaPulse = {
	live: 0,
	registration: 0,
	checkIn: 0,
	liveMatches: 0,
	escrowLabel: 'на эскроу нет',
	champions: [],
	fundCups: [],
	gathering: []
};

export type HomePulseCupSource = {
	id: string;
	title: string;
	status: string;
	prizePool: number;
	prizeCurrency: string | null;
	prizeStatus: string;
	maxTeams: number;
	teamCount: number;
	startAt: string;
};

export function homePulseCupHref(id: string) {
	return `/tournaments/${id}#matches`;
}

function toPulseCup(cup: HomePulseCupSource): HomePulseCup {
	return {
		id: cup.id,
		title: cup.title,
		href: homePulseCupHref(cup.id),
		statusLabel: tournamentStatusLabel(cup.status),
		prizeLabel: publicPrizeCaption(cup.prizeStatus, cup.prizePool, cup.prizeCurrency ?? 'RUB').label,
		teamsLabel: `${cup.teamCount} из ${cup.maxTeams}`
	};
}

export function pickFundCups(cups: HomePulseCupSource[]): HomePulseCup[] {
	return cups
		.filter((cup) => landingPrizeKind(cup.prizeStatus, cup.prizePool) !== 'none')
		.sort((left, right) => right.prizePool - left.prizePool || left.title.localeCompare(right.title, 'ru'))
		.map(toPulseCup);
}

export function pickGatheringCups(cups: HomePulseCupSource[], take = 5): HomePulseCup[] {
	return cups
		.filter((cup) => cup.status === 'REGISTRATION')
		.sort((left, right) => right.teamCount - left.teamCount || right.prizePool - left.prizePool || left.startAt.localeCompare(right.startAt))
		.slice(0, take)
		.map(toPulseCup);
}

export type HomeNearestCup =
	| { kind: 'card'; card: HomeLiveCard }
	| { kind: 'open'; cup: HomeOpenCup };

export type PrimaryHomeStep =
	| { kind: 'card'; card: HomeLiveCard }
	| { kind: 'roster'; gap: RosterGap }
	| { kind: 'apply'; gap: RosterGap };

const HOME_URGENCY: MatchDayActionCode[] = [
	'dispute',
	'report',
	'wait_rival',
	'join_lobby',
	'post_lobby',
	'wait_lobby',
	'check_in',
	'ready',
	'scrim',
	'wait_review',
	'wait_start',
	'watch',
	'recap',
	'browse',
	'done'
];

const PLAYER_ACT = new Set<MatchDayActionCode>(['dispute', 'report', 'join_lobby', 'post_lobby', 'check_in', 'ready', 'scrim']);
const CAPTAIN_ACT = new Set<MatchDayActionCode>(['report', 'post_lobby', 'check_in', 'scrim']);

export function homeActionUrgency(code: MatchDayActionCode) {
	const rank = HOME_URGENCY.indexOf(code);
	return rank < 0 ? 99 : rank;
}

export function pickPrimaryHomeCard(cards: HomeLiveCard[]): HomeLiveCard | null {
	if (!cards.length) return null;
	return [...cards].sort((left, right) => {
		const byAction = homeActionUrgency(left.action.code) - homeActionUrgency(right.action.code);
		if (byAction !== 0) return byAction;
		return Date.parse(left.startAt) - Date.parse(right.startAt);
	})[0];
}

export function cardNeedsThisPlayer(card: HomeLiveCard): boolean {
	if (!PLAYER_ACT.has(card.action.code)) return false;
	if (card.action.code === 'dispute' || card.action.code === 'ready') return true;
	if (card.action.code === 'join_lobby' && (card.isSubstitute || Boolean(card.benchNote))) return false;
	if (CAPTAIN_ACT.has(card.action.code) && !card.isCaptain && !card.isDeputy) return false;
	return true;
}

export function homeStepAction(card: HomeLiveCard): MatchDayAction {
	if (cardNeedsThisPlayer(card)) return card.action;
	if (card.isSubstitute || card.benchNote) {
		return {
			code: 'wait_start',
			label: 'Ждём капитана',
			hint: 'Вы запасной. Счёт, лобби и замена — через капитана на карточке турнира.'
		};
	}
	if (!card.isCaptain && !card.isDeputy && (CAPTAIN_ACT.has(card.action.code) || card.action.code === 'wait_rival')) {
		return {
			code: 'watch',
			label: 'Ждём капитана',
			hint: 'Счёт и лобби сдаёт капитан. Вам достаточно открыть карточку пары.'
		};
	}
	return card.action;
}

export function isOwnOpenPair(card: HomeLiveCard): boolean {
	if (!card.matchId) return false;
	if (['COMPLETED', 'TECHNICAL'].includes(card.matchStatus ?? '')) return false;
	if (['FINISHED', 'CANCELLED'].includes(card.tournamentStatus)) return false;
	if (card.action.code === 'done') return false;
	return true;
}

export function liveHomePairCount(cards: HomeLiveCard[]): number {
	return cards.filter((card) => card.matchStatus === 'LIVE').length;
}

export function ownOpenHomePairs(cards: HomeLiveCard[], exceptId?: string | null): HomeLiveCard[] {
	const seen = new Set<string>();
	return cards.filter((card) => {
		if (!isOwnOpenPair(card) || card.id === exceptId) return false;
		const key = card.matchId ?? card.id;
		if (seen.has(key)) return false;
		seen.add(key);
		return true;
	});
}

export function homeCupHint(card: Pick<HomeLiveCard, 'applicationStatus' | 'prizePool' | 'prizeStatus' | 'prizeCurrency'>): string {
	const pool = card.prizePool ?? 0;
	const status = card.prizeStatus ?? 'NONE';
	const prize = publicPrizeCaption(status, pool, card.prizeCurrency ?? 'RUB').label;
	return `${applicationStatusLabel(card.applicationStatus)} · ${prize}`;
}

/** Dispute and score deadline, then check-in and ready, then a 5/5 apply, then a roster hole, then the nearest cup. Watch and broadcast never outrank a deadline. */
export function pickPrimaryHomeStep(cards: HomeLiveCard[], gaps: RosterGap[] = []): PrimaryHomeStep | null {
	const urgent = pickPrimaryHomeCard(cards.filter(cardNeedsThisPlayer));
	if (urgent) return { kind: 'card', card: urgent };
	const apply = gaps.find((gap) => gap.readyToApply);
	if (apply) return { kind: 'apply', gap: apply };
	const fill = gaps.find((gap) => !gap.readyToApply && gap.needed > 0);
	if (fill) return { kind: 'roster', gap: fill };
	const own = pickPrimaryHomeCard(cards.filter((card) => card.action.code !== 'done' && card.action.code !== 'browse'));
	if (own) return { kind: 'card', card: own };
	const card = pickPrimaryHomeCard(cards);
	if (card) return { kind: 'card', card };
	return null;
}

export function resolveHomeTeamCard(myTeam: HomeTeamCard | null): HomeTeamCard | null {
	if (!myTeam?.id) return null;
	return myTeam;
}

export function pickNearestHomeCup(cards: HomeLiveCard[], openCup: HomeOpenCup | null): HomeNearestCup | null {
	const own =
		pickPrimaryHomeCard(cards.filter((card) => card.action.code !== 'done' && card.action.code !== 'browse')) ??
		cards[0] ??
		null;
	if (own) return { kind: 'card', card: own };
	if (openCup) return { kind: 'open', cup: openCup };
	return null;
}

export function homeOpenCupHint(cup: Pick<HomeOpenCup, 'status' | 'startLabel'>): string {
	return `${tournamentStatusLabel(cup.status)} · ${cup.startLabel} · приз только если фонд на эскроу`;
}

type PrizeSlice = { prizePool: number; prizeCurrency: string | null; prizeStatus: string };

function sumPrizeByCurrency(rows: PrizeSlice[], confirmed: boolean) {
	const totals = new Map<string, number>();
	for (const row of rows) {
		const kind = landingPrizeKind(row.prizeStatus, row.prizePool);
		if (confirmed ? kind !== 'confirmed' : kind !== 'unconfirmed') continue;
		const currency = row.prizeCurrency || 'RUB';
		totals.set(currency, (totals.get(currency) ?? 0) + row.prizePool);
	}
	return [...totals.entries()].map(([currency, amount]) => formatPrizeAmount(amount, currency));
}

export function arenaEscrowLabel(prizes: PrizeSlice[]) {
	const escrow = sumPrizeByCurrency(prizes, true);
	if (escrow.length > 0) return `${escrow.join(' · ')} на эскроу`;
	const declared = sumPrizeByCurrency(prizes, false);
	if (declared.length > 0) return `заявлено ${declared.join(' · ')}, на эскроу нет`;
	return 'на эскроу нет';
}

export function buildArenaPulse(input: {
	counts: { status: string; count: number }[];
	liveMatches: number;
	prizes: PrizeSlice[];
	champions: HomeChampion[];
	cups?: HomePulseCupSource[];
}): HomeArenaPulse {
	const count = (status: string) => input.counts.find((row) => row.status === status)?.count ?? 0;
	return {
		live: count('LIVE'),
		registration: count('REGISTRATION'),
		checkIn: count('CHECK_IN'),
		liveMatches: input.liveMatches,
		escrowLabel: arenaEscrowLabel(input.prizes),
		champions: input.champions,
		fundCups: pickFundCups(input.cups ?? []),
		gathering: pickGatheringCups(input.cups ?? [])
	};
}

export function pickRecentChampions(
	rows: {
		tournamentId: string;
		bracket: string;
		winnerTeamId: string | null;
		teamA: { id: string; name: string } | null;
		teamB: { id: string; name: string } | null;
		tournament: {
			id: string;
			title: string;
			prizePool: number;
			prizeCurrency: string | null;
			prizeStatus: string;
		};
	}[],
	take = 4
): HomeChampion[] {
	const chosen = new Map<string, (typeof rows)[number]>();
	const order: string[] = [];
	for (const row of rows) {
		if (!row.winnerTeamId) continue;
		const current = chosen.get(row.tournamentId);
		if (!current) {
			chosen.set(row.tournamentId, row);
			order.push(row.tournamentId);
			continue;
		}
		if (current.bracket !== 'grand' && row.bracket === 'grand') chosen.set(row.tournamentId, row);
	}
	const champions: HomeChampion[] = [];
	for (const id of order) {
		if (champions.length >= take) break;
		const row = chosen.get(id);
		if (!row?.winnerTeamId) continue;
		const team = [row.teamA, row.teamB].find((side) => side?.id === row.winnerTeamId);
		if (!team) continue;
		champions.push({
			tournamentId: row.tournament.id,
			title: row.tournament.title,
			href: `/tournaments/${row.tournament.id}`,
			teamName: team.name,
			prizeLabel: publicPrizeCaption(row.tournament.prizeStatus, row.tournament.prizePool, row.tournament.prizeCurrency ?? 'RUB').label
		});
	}
	return champions;
}
