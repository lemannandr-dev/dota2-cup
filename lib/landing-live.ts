import { formatPrizeAmount } from '@/lib/prize-places';
import { formatCopy, tournamentStatusCopy } from '@/lib/tournament-copy';

export type LandingPrizeKind = 'confirmed' | 'unconfirmed' | 'none';

export type LandingTournament = {
	id: string;
	title: string;
	href: string;
	formatLabel: string;
	series: string;
	region: string;
	rankCap: string;
	teams: number;
	maxTeams: number;
	prizeLabel: string;
	prizeKind: LandingPrizeKind;
	statusLabel: string;
	startLabel: string;
};

export type LandingBracketMatch = {
	id: string;
	href: string;
	roundLabel: string;
	teamA: string;
	teamB: string;
	scoreA: number;
	scoreB: number;
	bestOf: number;
	live: boolean;
};

export type LandingPlayer = {
	id: string;
	displayName: string;
	steamConfirmed: boolean;
	ratingLabel: string;
	looking: boolean;
	note: string | null;
	roles: number[];
};

export type LandingRoster = {
	id: string;
	name: string;
	confirmed: number;
	href: string;
};

export function landingPrizeKind(prizeStatus: string, prizePool: number): LandingPrizeKind {
	if (prizePool <= 0 || prizeStatus === 'NONE') return 'none';
	if (prizeStatus === 'CONFIRMED') return 'confirmed';
	return 'unconfirmed';
}

/** Amount is never shown without its escrow status. */
export function publicPrizeCaption(prizeStatus: string, prizePool: number, currency = 'RUB') {
	const kind = landingPrizeKind(prizeStatus, prizePool);
	if (kind === 'none') return { kind, label: 'без фонда' };
	const amount = formatPrizeAmount(prizePool, currency);
	if (kind === 'confirmed') return { kind, label: `${amount} на эскроу` };
	return { kind, label: `${amount} · фонд не зарезервирован` };
}

export function prizeHonestyHint(prizeStatus: string, prizePool: number) {
	if (landingPrizeKind(prizeStatus, prizePool) !== 'unconfirmed') return null;
	return 'Фонд ещё не зарезервирован — это не деньги на эскроу.';
}

export function mapLandingTournament(row: {
	id: string;
	title: string;
	format: string;
	seriesRules: string;
	region?: string | null;
	rankCap?: string | null;
	maxTeams: number;
	prizePool: number;
	prizeCurrency?: string | null;
	prizeStatus: string;
	status: string;
	startLabel: string;
	teamCount: number;
}): LandingTournament {
	const prizeKind = landingPrizeKind(row.prizeStatus, row.prizePool);
	return {
		id: row.id,
		title: row.title,
		href: `/tournaments/${row.id}`,
		formatLabel: formatCopy[row.format] ?? row.format,
		series: row.seriesRules,
		region: row.region?.trim() || 'Регион не указан',
		rankCap: row.rankCap?.trim() || 'Без ограничений',
		teams: row.teamCount,
		maxTeams: row.maxTeams,
		prizeLabel: publicPrizeCaption(row.prizeStatus, row.prizePool, row.prizeCurrency ?? 'RUB').label,
		prizeKind,
		statusLabel: tournamentStatusCopy[row.status]?.label ?? row.status,
		startLabel: row.startLabel
	};
}

export function filterLandingTournaments(
	rows: LandingTournament[],
	region: string,
	prize: 'any' | LandingPrizeKind
) {
	return rows.filter((row) => {
		if (region !== 'Все' && row.region !== region) return false;
		if (prize !== 'any' && row.prizeKind !== prize) return false;
		return true;
	});
}

export function pickLandingBracket<
	T extends {
		id: string;
		status: string;
		round: number;
		bracket: string;
		bestOf: number;
		scoreA: number;
		scoreB: number;
		teamA?: { name: string } | null;
		teamB?: { name: string } | null;
		tournamentId: string;
	}
>(matches: T[], limit = 5): LandingBracketMatch[] {
	const ready = matches.filter((match) => match.teamA && match.teamB);
	const ranked = [...ready].sort((a, b) => {
		const rank = (status: string) => (status === 'LIVE' ? 0 : status === 'NEEDS_REVIEW' ? 1 : ['COMPLETED', 'TECHNICAL'].includes(status) ? 3 : 2);
		return rank(a.status) - rank(b.status);
	});
	return ranked.slice(0, limit).map((match) => ({
		id: match.id,
		href: `/tournaments/${match.tournamentId}#match-${match.id}`,
		roundLabel: `Раунд ${match.round}`,
		teamA: match.teamA?.name ?? 'Ожидаем',
		teamB: match.teamB?.name ?? 'Ожидаем',
		scoreA: match.scoreA,
		scoreB: match.scoreB,
		bestOf: match.bestOf,
		live: match.status === 'LIVE'
	}));
}
