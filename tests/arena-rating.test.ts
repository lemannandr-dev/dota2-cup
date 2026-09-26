import { describe, expect, it } from 'vitest';
import { arenaRatingFromResults, formatStoredArenaRating } from '@/lib/arena-rating';

describe('arena rating', () => {
	it('stays unrated until a tournament pair is finished', () => {
		expect(arenaRatingFromResults([])).toEqual({
			rating: 1000,
			games: 0,
			wins: 0,
			losses: 0,
			rated: false
		});
		expect(formatStoredArenaRating(1000, 0)).toBe('нет игр');
	});

	it('adds 16 for a win and subtracts 12 for a loss', () => {
		expect(arenaRatingFromResults([{ won: true }, { won: false }, { won: true }])).toEqual({
			rating: 1020,
			games: 3,
			wins: 2,
			losses: 1,
			rated: true
		});
		expect(formatStoredArenaRating(1020, 3)).toBe('1020 · 3 игр');
	});

	it('does not fall below 100', () => {
		const losses = Array.from({ length: 80 }, () => ({ won: false }));
		expect(arenaRatingFromResults(losses).rating).toBe(100);
	});
});
