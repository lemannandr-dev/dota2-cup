import { ARENA_RATING_LOSS, ARENA_RATING_WIN } from '@/lib/arena-rating';

export const PLUS_RECAP_HINT =
	'Бейдж Plus за эту пару не ставится. Plus — официальный XP героя из реплея на /heroes, не вход на матч и не +16 арены.';

export type MatchRecapAbilityIcon = {
	id: string;
	name?: string;
	src: string;
};

export type MatchRecap = {
	matchId: string;
	scoreLabel: string;
	won: boolean;
	technical: boolean;
	ratingDelta: number;
	ratingLabel: string;
	yourTeam: string;
	opponent: string | null;
	nextHint: string;
	plusHint: string;
	/** Ability icons — only when match payload includes ability ids (recap surface only). */
	abilityIcons?: MatchRecapAbilityIcon[];
};

const ABILITY_CDN = 'https://cdn.cloudflare.steamstatic.com/apps/dota2/images/dota_react/abilities';

/** Top ability names from an OpenDota ability_uses map. Empty input stays empty. */
export function abilityIdsFromUses(uses: Record<string, number> | null | undefined, limit = 4): string[] | undefined {
	if (!uses) return undefined;
	const ids = Object.entries(uses)
		.filter(([, count]) => Number(count) > 0)
		.sort((left, right) => Number(right[1]) - Number(left[1]))
		.slice(0, Math.max(0, limit))
		.map(([id]) => id);
	return ids.length ? ids : undefined;
}

/** Build optional ability icon row for match recap. Empty input → undefined (do not render). */
export function abilityIconsFromIds(ids: Array<string | number> | null | undefined): MatchRecapAbilityIcon[] | undefined {
	if (!ids?.length) return undefined;
	const icons = ids
		.map((raw) => String(raw).trim())
		.filter(Boolean)
		.map((id) => ({
			id,
			src: `${ABILITY_CDN}/${id}.png`
		}));
	return icons.length ? icons : undefined;
}

export function buildMatchRecap(input: {
	matchId: string;
	status: string;
	scoreA: number;
	scoreB: number;
	winnerTeamId?: string | null;
	teamId: string;
	teamName: string;
	opponentName?: string | null;
	nextMatchId?: string | null;
	nextLoserMatchId?: string | null;
	abilityIds?: Array<string | number> | null;
	finaleHint?: string | null;
}): MatchRecap | null {
	if (!['COMPLETED', 'TECHNICAL'].includes(input.status) || !input.winnerTeamId) return null;
	const won = input.winnerTeamId === input.teamId;
	const ratingDelta = won ? ARENA_RATING_WIN : -ARENA_RATING_LOSS;
	let nextHint = won
		? input.nextMatchId
			? 'Вы вышли дальше. Следующая пара появится на карточке, когда будет известен соперник.'
			: 'Это последняя пара для победителя. Ждите итог турнира на карточке.'
		: input.nextLoserMatchId
			? 'Поражение в верхней сетке. Нижняя сетка — на карточке турнира.'
			: 'Вы выбыли. Рейтинг арены уже записан.';
	if (input.finaleHint) nextHint = input.finaleHint;
	if (input.status === 'TECHNICAL') {
		nextHint = `${won ? 'Техническая победа.' : 'Техническое поражение.'} ${nextHint}`;
	}
	return {
		matchId: input.matchId,
		scoreLabel: `${input.scoreA}:${input.scoreB}`,
		won,
		technical: input.status === 'TECHNICAL',
		ratingDelta,
		ratingLabel: ratingDelta > 0 ? `+${ratingDelta} рейтинг арены` : `${ratingDelta} рейтинг арены`,
		yourTeam: input.teamName,
		opponent: input.opponentName ?? null,
		nextHint,
		plusHint: PLUS_RECAP_HINT,
		abilityIcons: abilityIconsFromIds(input.abilityIds)
	};
}

export function pickLatestClosedMatch<
	T extends { status: string; winnerTeamId?: string | null; finishedAt?: Date | string | null }
>(matches: T[]): T | null {
	const closed = matches.filter((match) => ['COMPLETED', 'TECHNICAL'].includes(match.status) && match.winnerTeamId);
	if (!closed.length) return null;
	return [...closed].sort((a, b) => {
		const left = a.finishedAt ? new Date(a.finishedAt).getTime() : 0;
		const right = b.finishedAt ? new Date(b.finishedAt).getTime() : 0;
		return right - left;
	})[0];
}
