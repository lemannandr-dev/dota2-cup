import { describe, expect, it } from 'vitest';
import { isSteamCorridorUser } from '@/lib/access-policy';
import { landingPrizeKind } from '@/lib/landing-live';
import { decideClosedCheckIn } from '@/lib/tournament-tick-policy';
import { reportedTeamIdsOf } from '@/lib/roster-swap';
import { assertEligibleRoster } from '@/server/tournaments/eligibility';
import { DomainError } from '@/server/errors';

function member(id: string, steamId: string | null) {
	return {
		userId: id,
		isSubstitute: false,
		confirmed: true,
		user: { id, steamId, displayName: id }
	};
}

describe('battle corridor', () => {
	it('lets only a Steam account into the corridor', () => {
		expect(isSteamCorridorUser({ steamId: '76561198835548729' })).toBe(true);
		expect(isSteamCorridorUser({ steamId: null })).toBe(false);
		expect(isSteamCorridorUser(null)).toBe(false);
	});

	it('blocks apply without five unique Steam IDs', () => {
		expect(() => assertEligibleRoster([member('1', 's1'), member('2', 's2')])).toThrow(DomainError);
		expect(
			assertEligibleRoster([1, 2, 3, 4, 5].map((n) => member(String(n), `steam${n}`))).steamIds
		).toHaveLength(5);
	});

	it('opens the bracket only after check-in with two ready fives', () => {
		const now = new Date('2026-08-26T12:00:00.000Z');
		expect(
			decideClosedCheckIn({
				status: 'CHECK_IN',
				checkInClosesAt: '2026-08-26T11:00:00.000Z',
				existingMatchCount: 0,
				checkedInCount: 2,
				now
			})
		).toBe('generate');
		expect(
			decideClosedCheckIn({
				status: 'CHECK_IN',
				checkInClosesAt: '2026-08-26T11:00:00.000Z',
				existingMatchCount: 0,
				checkedInCount: 1,
				now
			})
		).toBe('cancel');
	});

	it('reads match reports as team ids and does not invent a reserved prize', () => {
		expect(reportedTeamIdsOf({ reports: [{ teamId: 't1' }, { teamId: 't2' }] })).toEqual(['t1', 't2']);
		expect(reportedTeamIdsOf({})).toEqual([]);
		expect(landingPrizeKind('NONE', 0)).toBe('none');
		expect(landingPrizeKind('UNCONFIRMED', 1500000)).toBe('unconfirmed');
		expect(landingPrizeKind('CONFIRMED', 1500000)).toBe('confirmed');
	});
});
