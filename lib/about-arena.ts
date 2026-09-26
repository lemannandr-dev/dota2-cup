import { catalogPrizeLine, catalogStatusLabel } from '@/lib/tournament-catalog';
import { formatCopy } from '@/lib/tournament-copy';
import { seedOrder } from '@/lib/bracket-pure';
import type { CupTrophyView } from '@/lib/cup-trophy';
import { aegisAwardOf, parseAegisAward, type AegisAwardDef } from '@/lib/aegis-awards';

export type AboutCupCard = {
	id: string;
	title: string;
	href: string;
	status: string;
	statusLabel: string;
	formatLabel: string;
	prizeLabel: string;
	prizeHint: string | null;
	teams: number;
	maxTeams: number;
	championName: string | null;
	awarded: boolean;
	trophy: CupTrophyView | null;
	award: AegisAwardDef;
};

export type AboutBracketPair = {
	id: string;
	href?: string;
	round: number;
	teamA: string;
	teamB: string;
	scoreA: number | null;
	scoreB: number | null;
	live: boolean;
	done: boolean;
};

export type AboutBracketStory = {
	source: 'live' | 'finished' | 'schematic';
	cupId: string | null;
	cupTitle: string;
	href: string | null;
	formatLabel: string;
	rounds: AboutBracketPair[][];
};

export function aboutRoundLabel(round: number, lastRound: number) {
	if (round === lastRound) return 'Финал';
	if (round === lastRound - 1) return 'Полуфинал';
	if (round === lastRound - 2) return 'Четвертьфинал';
	return `Раунд ${round}`;
}

export function groupBracketRounds(pairs: AboutBracketPair[]): AboutBracketPair[][] {
	const byRound = new Map<number, AboutBracketPair[]>();
	for (const pair of pairs) {
		const list = byRound.get(pair.round) ?? [];
		list.push(pair);
		byRound.set(pair.round, list);
	}
	return [...byRound.keys()]
		.sort((left, right) => left - right)
		.map((round) => byRound.get(round) ?? []);
}

export function schematicEightBracket(): AboutBracketStory {
	const seeds = seedOrder(8);
	const quarter: AboutBracketPair[] = [];
	for (let i = 0; i < 4; i++) {
		quarter.push({
			id: `schematic-qf-${i}`,
			round: 1,
			teamA: `Посев ${seeds[i * 2]}`,
			teamB: `Посев ${seeds[i * 2 + 1]}`,
			scoreA: null,
			scoreB: null,
			live: false,
			done: false
		});
	}
	const semi: AboutBracketPair[] = [
		{ id: 'schematic-sf-0', round: 2, teamA: 'Победитель 1', teamB: 'Победитель 2', scoreA: null, scoreB: null, live: false, done: false },
		{ id: 'schematic-sf-1', round: 2, teamA: 'Победитель 3', teamB: 'Победитель 4', scoreA: null, scoreB: null, live: false, done: false }
	];
	const final: AboutBracketPair[] = [
		{ id: 'schematic-f', round: 3, teamA: 'Полуфинал', teamB: 'Полуфинал', scoreA: null, scoreB: null, live: false, done: false }
	];
	return {
		source: 'schematic',
		cupId: null,
		cupTitle: 'Олимпийка на 8',
		href: null,
		formatLabel: 'Олимпийка',
		rounds: [quarter, semi, final]
	};
}

export function mapAboutCup(input: {
	id: string;
	title: string;
	status: string;
	format: string;
	prizePool: number;
	prizeStatus: string;
	prizeCurrency?: string | null;
	maxTeams: number;
	teams: number;
	trophy: CupTrophyView | null;
	aegisAward?: string | null;
}): AboutCupCard {
	const prize = catalogPrizeLine(input.prizeStatus, input.prizePool, input.prizeCurrency ?? 'RUB');
	const awarded = Boolean(input.trophy && input.status === 'FINISHED');
	return {
		id: input.id,
		title: input.title,
		href: awarded ? `/tournaments/${input.id}/cup` : `/tournaments/${input.id}`,
		status: input.status,
		statusLabel: catalogStatusLabel(input.status),
		formatLabel: formatCopy[input.format] ?? input.format,
		prizeLabel: prize.label,
		prizeHint: prize.kind === 'unconfirmed' ? 'Сумма есть, эскроу нет — это не выплата.' : null,
		teams: input.teams,
		maxTeams: input.maxTeams,
		championName: input.trophy?.winnerTeamName ?? null,
		awarded,
		trophy: awarded ? input.trophy : null,
		award: input.trophy?.award ?? aegisAwardOf(parseAegisAward(input.aegisAward))
	};
}

export function pickAboutCups(rows: AboutCupCard[], limit = 6) {
	const open = rows.filter((row) => ['REGISTRATION', 'CHECK_IN', 'LIVE'].includes(row.status));
	const awarded = rows.filter((row) => row.awarded);
	return [...open, ...awarded].slice(0, limit);
}
