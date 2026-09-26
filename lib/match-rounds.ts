const BRACKET_ORDER: Record<string, number> = {
	winners: 0,
	losers: 1,
	grand: 2,
	preview: 3
};

export type MatchRoundGroup<T> = {
	key: string;
	bracket: string;
	round: number;
	matches: T[];
};

export function matchRoundKey(match: { bracket: string; round: number }) {
	return `${match.bracket}:${match.round}`;
}

export function winsToTakeSeries(bestOf: number) {
	const games = Math.max(1, Math.floor(bestOf));
	return Math.floor(games / 2) + 1;
}

export function groupMatchRounds<T extends { bracket: string; round: number }>(matches: T[]): MatchRoundGroup<T>[] {
	const groups = new Map<string, MatchRoundGroup<T>>();
	for (const match of matches) {
		const key = matchRoundKey(match);
		const group = groups.get(key) ?? { key, bracket: match.bracket, round: match.round, matches: [] };
		group.matches.push(match);
		groups.set(key, group);
	}
	return [...groups.values()].sort((left, right) => {
		const byBracket = (BRACKET_ORDER[left.bracket] ?? 9) - (BRACKET_ORDER[right.bracket] ?? 9);
		return byBracket || left.round - right.round;
	});
}
