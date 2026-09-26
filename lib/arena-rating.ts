export const ARENA_RATING_START = 1000;
export const ARENA_RATING_WIN = 16;
export const ARENA_RATING_LOSS = 12;

export type ArenaMatchResult = { won: boolean };

export type ArenaRatingSummary = {
	rating: number;
	games: number;
	wins: number;
	losses: number;
	rated: boolean;
};

export function arenaRatingFromResults(results: ArenaMatchResult[]): ArenaRatingSummary {
	let rating = ARENA_RATING_START;
	let wins = 0;
	let losses = 0;
	for (const row of results) {
		if (row.won) {
			rating += ARENA_RATING_WIN;
			wins += 1;
		} else {
			rating -= ARENA_RATING_LOSS;
			losses += 1;
		}
	}
	return {
		rating: Math.max(100, rating),
		games: results.length,
		wins,
		losses,
		rated: results.length > 0
	};
}

export function formatArenaRating(input: { rating: number; games?: number | null; rated?: boolean }) {
	const rated = input.rated ?? (input.games ?? 0) > 0;
	if (!rated) return 'нет игр';
	return String(input.rating);
}

export function formatArenaRatingDetail(summary: ArenaRatingSummary) {
	if (!summary.rated) return 'нет игр';
	return `${summary.rating} · ${summary.wins}–${summary.losses}`;
}

export function formatStoredArenaRating(rating: number, games: number) {
	if (games <= 0) return 'нет игр';
	return `${rating} · ${games} игр`;
}
