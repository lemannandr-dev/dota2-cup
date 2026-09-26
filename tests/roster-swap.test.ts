import { describe, expect, it } from 'vitest';
import {
	decideRosterSwap,
	displayedRoster,
	pairBlocksRosterSwap,
	shouldFreezeHistoricalMatch
} from '@/lib/roster-swap';

const five = [1, 2, 3, 4, 5].map((n) => ({
	userId: `u${n}`,
	steamId: `s${n}`,
	displayName: `P${n}`
}));

const base = {
	tournamentStatus: 'LIVE',
	applicationStatus: 'IN_BRACKET',
	outUserId: 'u5',
	incoming: { userId: 'u6', confirmed: true, steamId: 's6', displayName: 'Sub' },
	currentSnapshot: five,
	incomingOnOtherTeam: false,
	pairInProgress: false
};

describe('decideRosterSwap', () => {
	it('replaces a starter after check-in and keeps the other four', () => {
		const result = decideRosterSwap(base);
		expect(result.ok).toBe(true);
		if (!result.ok) return;
		expect(result.players.map((row) => row.userId)).toEqual(['u1', 'u2', 'u3', 'u4', 'u6']);
		expect(result.snapshot.players).toHaveLength(5);
	});

	it('refuses a swap before check-in or after the pair started', () => {
		expect(decideRosterSwap({ ...base, applicationStatus: 'APPROVED' }).ok).toBe(false);
		expect(decideRosterSwap({ ...base, pairInProgress: true }).ok).toBe(false);
		expect(decideRosterSwap({ ...base, incomingOnOtherTeam: true }).ok).toBe(false);
		expect(decideRosterSwap({ ...base, incoming: { ...base.incoming, steamId: null } }).ok).toBe(false);
	});
});

describe('pair freeze', () => {
	it('locks an unfinished pair after a report, but not a finished one', () => {
		expect(
			pairBlocksRosterSwap(
				{ status: 'SCHEDULED', teamAId: 't1', teamBId: 't2', reportedTeamIds: ['t1'] },
				't1'
			)
		).toBe(true);
		expect(
			pairBlocksRosterSwap({ status: 'COMPLETED', teamAId: 't1', teamBId: 't2', frozenA: true }, 't1')
		).toBe(false);
		expect(
			pairBlocksRosterSwap({ status: 'PENDING', teamAId: 't1', teamBId: 't2', reportedTeamIds: [] }, 't1')
		).toBe(false);
	});

	it('shows the frozen five on a played pair, not the live application', () => {
		const live = [...five, { userId: 'u6', steamId: 's6', displayName: 'Sub' }].slice(1);
		expect(displayedRoster(five, live).map((row) => row.userId)).toEqual(['u1', 'u2', 'u3', 'u4', 'u5']);
		expect(shouldFreezeHistoricalMatch('COMPLETED', false)).toBe(true);
		expect(shouldFreezeHistoricalMatch('PENDING', false)).toBe(false);
	});
});
