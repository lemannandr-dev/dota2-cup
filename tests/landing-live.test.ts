import { describe, expect, it } from 'vitest';
import { filterLandingTournaments, landingPrizeKind, mapLandingTournament, pickLandingBracket, prizeHonestyHint } from '@/lib/landing-live';

describe('landing live cards', () => {
	it('does not mark an empty prize pool as a reserved fund', () => {
		expect(landingPrizeKind('CONFIRMED', 0)).toBe('none');
		expect(landingPrizeKind('UNCONFIRMED', 15000)).toBe('unconfirmed');
		expect(landingPrizeKind('CONFIRMED', 15000)).toBe('confirmed');
		expect(prizeHonestyHint('UNCONFIRMED', 1_500_000)).toMatch(/не зарезервирован/);
		expect(prizeHonestyHint('CONFIRMED', 1_500_000)).toBeNull();
	});

	it('maps a tournament without inventing organizer reliability or a fake medal', () => {
		const card = mapLandingTournament({
			id: 't1',
			title: 'Weekend Clash',
			format: 'SINGLE_ELIMINATION',
			seriesRules: 'BO3',
			region: 'CIS',
			maxTeams: 8,
			prizePool: 10000,
			prizeStatus: 'CONFIRMED',
			status: 'REGISTRATION',
			startLabel: '24.08 18:00',
			teamCount: 3
		});
		expect(card.prizeLabel).toContain('₽');
		expect(card.prizeLabel).toMatch(/на эскроу/);
		expect(card.prizeKind).toBe('confirmed');
		expect(JSON.stringify(card)).not.toMatch(/надёжность|98%|Winter Open/i);
	});

	it('filters by region and escrow and picks real pairs first', () => {
		const rows = [
			mapLandingTournament({
				id: 'a',
				title: 'A',
				format: 'SINGLE_ELIMINATION',
				seriesRules: 'BO1',
				region: 'CIS',
				maxTeams: 8,
				prizePool: 0,
				prizeStatus: 'NONE',
				status: 'LIVE',
				startLabel: 'x',
				teamCount: 2
			}),
			mapLandingTournament({
				id: 'b',
				title: 'B',
				format: 'SINGLE_ELIMINATION',
				seriesRules: 'BO1',
				region: 'EU East',
				maxTeams: 8,
				prizePool: 5000,
				prizeStatus: 'CONFIRMED',
				status: 'REGISTRATION',
				startLabel: 'x',
				teamCount: 1
			})
		];
		expect(filterLandingTournaments(rows, 'CIS', 'any')).toHaveLength(1);
		expect(filterLandingTournaments(rows, 'Все', 'confirmed')[0].id).toBe('b');
		expect(
			pickLandingBracket([
				{
					id: 'm1',
					status: 'COMPLETED',
					round: 1,
					bracket: 'winners',
					bestOf: 1,
					scoreA: 1,
					scoreB: 0,
					tournamentId: 'a',
					teamA: { name: 'Alpha' },
					teamB: { name: 'Beta' }
				},
				{
					id: 'm2',
					status: 'LIVE',
					round: 2,
					bracket: 'winners',
					bestOf: 3,
					scoreA: 1,
					scoreB: 1,
					tournamentId: 'a',
					teamA: { name: 'Gamma' },
					teamB: { name: 'Delta' }
				}
			])[0]
		).toMatchObject({ id: 'm2', live: true });
	});
});
