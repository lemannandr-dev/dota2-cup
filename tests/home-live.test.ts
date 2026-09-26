import { describe, expect, it } from 'vitest';
import {
	buildArenaPulse,
	pickFundCups,
	pickGatheringCups,
	cardNeedsThisPlayer,
	homeCupHint,
	homeOpenCupHint,
	homeStepAction,
	liveHomePairCount,
	ownOpenHomePairs,
	pickNearestHomeCup,
	pickPrimaryHomeCard,
	pickPrimaryHomeStep,
	pickRecentChampions,
	resolveHomeTeamCard,
	type HomeLiveCard,
	type RosterGap
} from '@/lib/home-live';

function card(partial: Partial<HomeLiveCard> & Pick<HomeLiveCard, 'id' | 'action'>): HomeLiveCard {
	return {
		title: partial.title ?? partial.id,
		href: `/tournaments/${partial.id}`,
		startAt: partial.startAt ?? '2026-08-24T18:00:00.000Z',
		startLabel: '',
		teamName: 'A',
		teamA: null,
		teamB: null,
		scoreA: 0,
		scoreB: 0,
		bestOf: 1,
		matchId: null,
		matchStatus: null,
		tournamentId: partial.id,
		tournamentStatus: 'LIVE',
		applicationStatus: 'IN_BRACKET',
		checklist: [],
		channels: [],
		roster: [],
		isCaptain: true,
		opponentName: null,
		lobbyName: null,
		lobbyPassword: null,
		lobbyRegion: null,
		lobbyVoice: null,
		lobbyPlaying: false,
		recap: null,
		...partial
	};
}

const gap: RosterGap = {
	teamId: 'team-1',
	teamName: 'Iskry',
	confirmed: 2,
	withSteam: 2,
	needed: 3,
	tournamentId: 'clash',
	tournamentTitle: 'Aegis Weekend Clash'
};

describe('pickPrimaryHomeStep', () => {
	it('prefers a live pair over filling the roster', () => {
		const report = card({ id: 'live', action: { code: 'report', label: 'Сдать счёт пары', hint: '' } });
		const wait = card({ id: 'old', action: { code: 'wait_start', label: 'Ждём день старта', hint: '' } });
		expect(pickPrimaryHomeCard([wait, report])?.id).toBe('live');
		expect(pickPrimaryHomeStep([wait, report], [gap])).toEqual({ kind: 'card', card: report });
	});

	it('asks to fill the five-stack when no pair needs the player', () => {
		const done = card({ id: 'fin', action: { code: 'done', label: 'Турнир завершён', hint: '' } });
		expect(pickPrimaryHomeStep([done], [gap])).toEqual({ kind: 'roster', gap });
		expect(pickPrimaryHomeStep([], [gap])?.kind).toBe('roster');
	});

	it('asks to register a ready five-stack before a finished card', () => {
		const apply: RosterGap = { ...gap, needed: 0, withSteam: 5, confirmed: 5, readyToApply: true };
		const done = card({ id: 'fin', action: { code: 'done', label: 'Турнир завершён', hint: '' } });
		expect(pickPrimaryHomeStep([done], [gap, apply])).toEqual({ kind: 'apply', gap: apply });
	});

	it('does not ask a substitute to report a pair when the five-stack is incomplete', () => {
		const wait = card({
			id: 'pair',
			isCaptain: false,
			isSubstitute: true,
			benchNote: 'Запасной',
			action: { code: 'wait_rival', label: 'Ждём счёт соперника', hint: '' }
		});
		expect(cardNeedsThisPlayer(wait)).toBe(false);
		expect(pickPrimaryHomeStep([wait], [gap])).toEqual({ kind: 'roster', gap });
		expect(homeStepAction(wait).label).toBe('Ждём капитана');
	});

	it('treats wait_rival as waiting, so a holey five-stack comes first', () => {
		const wait = card({
			id: 'pair',
			isCaptain: true,
			action: { code: 'wait_rival', label: 'Ждём счёт соперника', hint: '' }
		});
		expect(cardNeedsThisPlayer(wait)).toBe(false);
		expect(pickPrimaryHomeStep([wait], [gap])).toEqual({ kind: 'roster', gap });
	});

	it('counts only LIVE matches, not every application in a live cup', () => {
		const live = card({ id: 'a', matchStatus: 'LIVE', matchId: 'm1', action: { code: 'join_lobby', label: '', hint: '' } });
		const sameCup = card({ id: 'b', tournamentStatus: 'LIVE', matchId: null, action: { code: 'watch', label: '', hint: '' } });
		const stale = card({
			id: 'c',
			matchId: 'old',
			matchStatus: 'COMPLETED',
			tournamentStatus: 'FINISHED',
			action: { code: 'done', label: '', hint: '' }
		});
		expect(liveHomePairCount([live, sameCup, stale])).toBe(1);
		expect(ownOpenHomePairs([live, sameCup, stale]).map((row) => row.id)).toEqual(['a']);
		const clone = card({ id: 'a2', matchId: 'm1', matchStatus: 'SCHEDULED', action: { code: 'wait_rival', label: '', hint: '' } });
		expect(ownOpenHomePairs([live, clone]).map((row) => row.id)).toEqual(['a']);
	});

	it('writes cup status and escrow, not the pair action twice', () => {
		expect(
			homeCupHint({
				applicationStatus: 'IN_BRACKET',
				prizePool: 0,
				prizeStatus: 'NONE'
			})
		).toMatch(/без фонда/i);
		expect(
			homeCupHint({
				applicationStatus: 'CHECKED_IN',
				prizePool: 100000,
				prizeStatus: 'UNCONFIRMED'
			})
		).toMatch(/фонд не зарезервирован/);
		expect(
			homeCupHint({
				applicationStatus: 'IN_BRACKET',
				prizePool: 1500000,
				prizeStatus: 'CONFIRMED'
			})
		).toMatch(/на эскроу/);
	});

	it('keeps a report deadline and an open dispute ahead of check-in, a ready five, and a watch card', () => {
		const dispute = card({ id: 'dispute', action: { code: 'dispute', label: 'Открыт спор', hint: '' } });
		const report = card({ id: 'report', action: { code: 'report', label: 'Сдать счёт', hint: '' } });
		const checkIn = card({ id: 'check', action: { code: 'check_in', label: 'Check-in', hint: '' } });
		const ready = card({ id: 'ready', action: { code: 'ready', label: 'Готовность', hint: '' } });
		const watch = card({ id: 'watch', isCaptain: false, action: { code: 'watch', label: 'Смотреть', hint: '' } });
		const apply: RosterGap = { ...gap, needed: 0, withSteam: 5, confirmed: 5, readyToApply: true };

		expect(pickPrimaryHomeStep([watch, ready, checkIn, report, dispute], [apply, gap])).toMatchObject({
			kind: 'card',
			card: { id: 'dispute' }
		});
		expect(pickPrimaryHomeStep([watch, checkIn, report], [apply])).toMatchObject({ kind: 'card', card: { id: 'report' } });
		expect(pickPrimaryHomeStep([watch, ready, checkIn], [apply])).toMatchObject({ kind: 'card', card: { id: 'check' } });
		expect(pickPrimaryHomeStep([watch, ready], [apply])).toMatchObject({ kind: 'card', card: { id: 'ready' } });
		expect(pickPrimaryHomeStep([watch], [apply])).toEqual({ kind: 'apply', gap: apply });
		expect(pickPrimaryHomeStep([watch], [gap])).toEqual({ kind: 'roster', gap });
		expect(pickPrimaryHomeStep([watch], [])).toMatchObject({ kind: 'card', card: { id: 'watch' } });
	});

	it('keeps an accepted scrim under a cup score deadline and above an empty catalog', () => {
		const report = card({ id: 'report', action: { code: 'report', label: 'Сдать счёт', hint: '' } });
		const scrim = card({ id: 'scrim', action: { code: 'scrim', label: 'Соперник принял вызов', hint: '' } });
		const watch = card({ id: 'watch', isCaptain: false, action: { code: 'watch', label: 'Смотреть', hint: '' } });
		expect(pickPrimaryHomeStep([watch, scrim, report], [gap])).toMatchObject({ kind: 'card', card: { id: 'report' } });
		expect(pickPrimaryHomeStep([watch, scrim], [gap])).toMatchObject({ kind: 'card', card: { id: 'scrim' } });
		expect(pickPrimaryHomeStep([watch], [])).toMatchObject({ kind: 'card', card: { id: 'watch' } });
	});
});

describe('home lobby cup and roster', () => {
	it('falls back to the nearest open cup when the player has no applications', () => {
		expect(pickNearestHomeCup([], null)).toBeNull();
		expect(
			pickNearestHomeCup([], {
				id: 'open-1',
				title: 'Aegis Weekend',
				href: '/tournaments/open-1',
				status: 'REGISTRATION',
				startAt: '2026-09-22T15:00:00.000Z',
				startLabel: '22 сент.'
			})
		).toEqual({
			kind: 'open',
			cup: {
				id: 'open-1',
				title: 'Aegis Weekend',
				href: '/tournaments/open-1',
				status: 'REGISTRATION',
				startAt: '2026-09-22T15:00:00.000Z',
				startLabel: '22 сент.'
			}
		});
		expect(homeOpenCupHint({ status: 'REGISTRATION', startLabel: '22 сент.' })).toMatch(/Регистрация/);
		expect(homeOpenCupHint({ status: 'LIVE', startLabel: '23 авг.' })).not.toMatch(/\.\./);
	});

	it('prefers an own live card over the catalog fallback', () => {
		const live = card({ id: 'mine', action: { code: 'check_in', label: 'Пройти check-in', hint: '' } });
		const nearest = pickNearestHomeCup(
			[live],
			{
				id: 'open-1',
				title: 'Other',
				href: '/tournaments/open-1',
				status: 'LIVE',
				startAt: '2026-09-22T15:00:00.000Z',
				startLabel: '22 сент.'
			}
		);
		expect(nearest).toEqual({ kind: 'card', card: live });
	});

	it('does not invent empty roster faces when myTeam is missing', () => {
		expect(resolveHomeTeamCard(null)).toBeNull();
		expect(
			resolveHomeTeamCard({
				id: 'team-1',
				name: 'Iskry',
				withSteam: 4,
				needed: 1,
				members: [{ id: 'u1', displayName: 'cap', avatarUrl: null, href: '/players/u1', medal: null, mmr: null, hasSteam: true }]
			})?.members
		).toHaveLength(1);
	});
});

describe('arena pulse', () => {
	it('sums confirmed escrow separately from a declared fund', () => {
		const pulse = buildArenaPulse({
			counts: [
				{ status: 'LIVE', count: 1 },
				{ status: 'REGISTRATION', count: 2 }
			],
			liveMatches: 3,
			prizes: [
				{ prizePool: 10000, prizeCurrency: 'RUB', prizeStatus: 'CONFIRMED' },
				{ prizePool: 5000, prizeCurrency: 'RUB', prizeStatus: 'UNCONFIRMED' }
			],
			champions: []
		});
		expect(pulse.live).toBe(1);
		expect(pulse.registration).toBe(2);
		expect(pulse.liveMatches).toBe(3);
		expect(pulse.escrowLabel).toBe('100 ₽ на эскроу');
		expect(pulse.fundCups).toEqual([]);
		expect(pulse.gathering).toEqual([]);
	});

	it('opens the funded cup bracket and keeps the five fullest registration cups', () => {
		const cup = (id: string, teamCount: number, prizePool = 0, status = 'REGISTRATION') => ({
			id,
			title: id,
			status,
			prizePool,
			prizeCurrency: 'RUB',
			prizeStatus: prizePool > 0 ? 'UNCONFIRMED' : 'NONE',
			maxTeams: 8,
			teamCount,
			startAt: '2026-09-22T12:00:00.000Z'
		});
		const funded = pickFundCups([cup('live-cup', 2, 1500000, 'LIVE'), cup('empty', 1, 0, 'LIVE')]);
		expect(funded).toHaveLength(1);
		expect(funded[0].href).toBe('/tournaments/live-cup#matches');
		expect(funded[0].title).toBe('live-cup');
		const gathering = pickGatheringCups([
			cup('a', 1),
			cup('b', 6),
			cup('c', 4),
			cup('d', 3),
			cup('e', 2),
			cup('f', 5),
			cup('live', 9, 0, 'LIVE')
		]);
		expect(gathering.map((row) => row.id)).toEqual(['b', 'f', 'c', 'd', 'e']);
	});

	it('keeps the grand-final winner when an earlier winners-final is also closed', () => {
		const champions = pickRecentChampions([
			{
				tournamentId: 'cup-1',
				bracket: 'winners',
				winnerTeamId: 'old',
				teamA: { id: 'old', name: 'Старая' },
				teamB: { id: 'other', name: 'Другая' },
				tournament: { id: 'cup-1', title: 'Weekend', prizePool: 0, prizeCurrency: 'RUB', prizeStatus: 'NONE' }
			},
			{
				tournamentId: 'cup-1',
				bracket: 'grand',
				winnerTeamId: 'new',
				teamA: { id: 'new', name: 'Финал' },
				teamB: { id: 'old', name: 'Старая' },
				tournament: { id: 'cup-1', title: 'Weekend', prizePool: 0, prizeCurrency: 'RUB', prizeStatus: 'NONE' }
			}
		]);
		expect(champions).toEqual([
			{
				tournamentId: 'cup-1',
				title: 'Weekend',
				href: '/tournaments/cup-1',
				teamName: 'Финал',
				prizeLabel: 'без фонда'
			}
		]);
	});
});
