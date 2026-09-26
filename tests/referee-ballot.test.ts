import { describe, expect, it } from 'vitest';
import {
	ballotOpen,
	canNominateReferee,
	canVoteReferee,
	pickBallotLeader,
	refereeRatingLabel,
	refereeSeat
} from '@/lib/referee-ballot';

describe('referee ballot', () => {
	it('marks the organizer and an assigned referee as already seated', () => {
		expect(refereeSeat({ userId: 'org', ownerId: 'org', staffRole: null })).toBe('owner');
		expect(refereeSeat({ userId: 'ref', ownerId: 'org', staffRole: 'REFEREE' })).toBe('referee');
		expect(refereeSeat({ userId: 'new', ownerId: 'org', staffRole: null })).toBe('open');
	});

	it('lets captains nominate and vote only while the cup is open', () => {
		expect(canNominateReferee({ tournamentStatus: 'LIVE', isCaptain: true })).toBe(true);
		expect(canNominateReferee({ tournamentStatus: 'LIVE', isCaptain: false })).toBe(false);
		expect(canVoteReferee({ tournamentStatus: 'FINISHED', isCaptain: true })).toBe(false);
		expect(ballotOpen('CHECK_IN')).toBe(true);
		expect(ballotOpen('DRAFT')).toBe(false);
	});

	it('picks a single vote leader and refuses a tie', () => {
		expect(pickBallotLeader([{ id: 'a', votes: 2 }, { id: 'b', votes: 1 }])?.id).toBe('a');
		expect(pickBallotLeader([{ id: 'a', votes: 1 }, { id: 'b', votes: 1 }])).toBeNull();
		expect(pickBallotLeader([{ id: 'a', votes: 0 }])).toBeNull();
	});

	it('writes the arena rating next to a referee', () => {
		expect(refereeRatingLabel(1480, 6)).toBe('рейтинг арены 1480 · 6 игр');
		expect(refereeRatingLabel(1000, 0)).toBe('рейтинг арены 1000 · игр нет');
	});
});
