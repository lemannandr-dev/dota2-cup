import { describe, expect, it } from 'vitest';
import {
	catalogActiveTeamCount,
	catalogCtaLabel,
	catalogFeaturedPair,
	catalogLiveMatchCount,
	catalogMatchesFacets,
	catalogMatchesFilter,
	catalogMyHint,
	catalogNextHint,
	catalogPrizeLine,
	isCatalogQuiet,
	pickCatalogMine,
	sortCatalogTournaments,
	splitCatalogCups
} from '@/lib/tournament-catalog';

describe('tournament catalog cards', () => {
	it('counts only teams still in the cup and live matches that are actually LIVE', () => {
		expect(
			catalogActiveTeamCount([{ status: 'IN_BRACKET' }, { status: 'REJECTED' }, { status: 'WITHDRAWN' }, { status: 'CHECKED_IN' }])
		).toBe(2);
		expect(catalogLiveMatchCount([{ status: 'SCHEDULED' }, { status: 'LIVE' }, { status: 'COMPLETED' }])).toBe(1);
	});

	it('does not sell an unconfirmed pool as escrow money', () => {
		expect(catalogPrizeLine('NONE', 0)).toEqual({ kind: 'none', label: 'без фонда', short: 'без фонда' });
		expect(catalogPrizeLine('UNCONFIRMED', 1_500_000).label).toMatch(/фонд не зарезервирован/);
		expect(catalogPrizeLine('CONFIRMED', 1_500_000).label).toMatch(/₽ на эскроу/);
		expect(catalogPrizeLine('CONFIRMED', 0).kind).toBe('none');
	});

	it('picks a real open pair and writes the next step from status, not a slogan', () => {
		expect(
			catalogFeaturedPair([
				{ status: 'COMPLETED', scoreA: 2, scoreB: 0, bestOf: 3, winnerTeamId: 'a', teamA: { name: 'A' }, teamB: { name: 'B' } },
				{ status: 'SCHEDULED', scoreA: 1, scoreB: 0, bestOf: 3, winnerTeamId: null, teamA: { name: 'Искры' }, teamB: { name: 'Стража' } }
			])
		).toMatchObject({ teamA: 'Искры', teamB: 'Стража', live: false });
		expect(catalogNextHint({ status: 'wait_rival' as never, teams: 8, maxTeams: 8, openMatches: 1, liveMatches: 0 })).toBe(
			'Откройте карточку кубка'
		);
		expect(catalogNextHint({ status: 'LIVE', teams: 8, maxTeams: 8, openMatches: 3, liveMatches: 0 })).toBe('Открытых пар: 3');
		expect(catalogNextHint({ status: 'REGISTRATION', teams: 3, maxTeams: 8, openMatches: 0, liveMatches: 0 })).toBe(
			'Приём заявок · свободно 5'
		);
		expect(catalogCtaLabel('LIVE')).toBe('К сетке');
	});

	it('puts live cups before finished ones', () => {
		const rows = sortCatalogTournaments([
			{ status: 'FINISHED', startAt: '2026-08-01T00:00:00.000Z' },
			{ status: 'LIVE', startAt: '2026-08-23T00:00:00.000Z' },
			{ status: 'REGISTRATION', startAt: '2026-08-10T00:00:00.000Z' }
		]);
		expect(rows.map((row) => row.status)).toEqual(['LIVE', 'REGISTRATION', 'FINISHED']);
	});

	it('puts finished and showcase cups in the quiet lane and keeps a live cup active', () => {
		expect(isCatalogQuiet({ status: 'LIVE', title: 'Aegis Weekend Clash' })).toBe(false);
		expect(isCatalogQuiet({ status: 'FINISHED', title: 'Витрина кубка Aegis 2026' })).toBe(true);
		expect(catalogMatchesFilter({ status: 'CHECK_IN' }, 'REGISTRATION')).toBe(false);
		expect(catalogMatchesFilter({ status: 'FINISHED' }, 'FINISHED')).toBe(true);
		const split = splitCatalogCups([
			{ status: 'LIVE', startAt: '2026-08-23T00:00:00.000Z', title: 'Clash' },
			{ status: 'FINISHED', startAt: '2026-08-01T00:00:00.000Z', title: 'Витрина кубка Aegis 2026' }
		]);
		expect(split.active.map((row) => row.title)).toEqual(['Clash']);
		expect(split.quiet).toHaveLength(1);
	});

	it('supports player-focused tabs and mobile catalog facets', () => {
		expect(catalogMatchesFilter({ status: 'REGISTRATION' }, 'AVAILABLE')).toBe(true);
		expect(catalogMatchesFilter({ status: 'LIVE', mine: { teamId: 'a' } }, 'MINE')).toBe(true);
		expect(catalogMatchesFilter({ status: 'LIVE' }, 'MINE')).toBe(false);

		const cup = { region: 'EU', rankCap: 'Ancient', startAt: '2026-09-08T15:00:00.000Z' };
		const now = new Date('2026-09-06T10:00:00.000Z');
		expect(catalogMatchesFacets(cup, { region: 'EU', date: 'WEEK', rank: 'CAPPED' }, now)).toBe(true);
		expect(catalogMatchesFacets(cup, { region: 'CIS', date: 'WEEK', rank: 'CAPPED' }, now)).toBe(false);
		expect(catalogMatchesFacets(cup, { region: 'EU', date: 'TODAY', rank: 'CAPPED' }, now)).toBe(false);
		expect(catalogMatchesFacets(cup, { region: 'EU', date: 'WEEK', rank: 'OPEN' }, now)).toBe(false);
	});

	it('writes a real own-team hint and picks the bracket application first', () => {
		expect(
			catalogMyHint({ teamName: 'Искры Древнего', applicationStatus: 'IN_BRACKET', cupStatus: 'LIVE', isCaptain: false, extraTeams: 2 })
		).toBe('«Искры Древнего» в сетке · ещё 2 ваших команд');
		expect(catalogMyHint({ teamName: 'A', applicationStatus: 'CHECKED_IN', cupStatus: 'CHECK_IN', isCaptain: true })).toBe(
			'Отметить состав «A»'
		);
		expect(
			pickCatalogMine([
				{ status: 'SUBMITTED', team: { members: [{ id: '1' }] } },
				{ status: 'IN_BRACKET', team: { members: [{ id: '1' }] } },
				{ status: 'APPROVED', team: { members: [] } }
			])?.status
		).toBe('IN_BRACKET');
	});
});
