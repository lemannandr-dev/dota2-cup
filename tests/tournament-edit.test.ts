import { describe, expect, it } from 'vitest';
import { canEditTournamentFields, nextPrizeStatusAfterPoolChange } from '@/lib/tournament-edit';

describe('tournament edit', () => {
	it('allows edit before LIVE and resets CONFIRMED only when fund grows', () => {
		expect(canEditTournamentFields('REGISTRATION')).toBe(true);
		expect(canEditTournamentFields('LIVE')).toBe(false);
		expect(nextPrizeStatusAfterPoolChange({ prizePool: 100, prizeStatus: 'CONFIRMED' }, 200)).toBe('UNCONFIRMED');
		expect(nextPrizeStatusAfterPoolChange({ prizePool: 100, prizeStatus: 'CONFIRMED' }, 80)).toBe('CONFIRMED');
		expect(nextPrizeStatusAfterPoolChange({ prizePool: 100, prizeStatus: 'UNCONFIRMED' }, 0)).toBe('NONE');
	});
});
