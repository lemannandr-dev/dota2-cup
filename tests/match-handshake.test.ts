import { describe, expect, it } from 'vitest';
import { applicationLane, applicationPlaceLabel, matchHandshake } from '@/lib/match-handshake';

describe('matchHandshake', () => {
	it('marks a score mismatch as disputed', () => {
		expect(matchHandshake({ status: 'NEEDS_REVIEW', teamAId: 'a', teamBId: 'b' })).toMatchObject({
			state: 'disputed'
		});
	});

	it('confirms a completed or technical pair', () => {
		expect(matchHandshake({ status: 'COMPLETED', teamAId: 'a', teamBId: 'b' }).state).toBe('confirmed');
		expect(matchHandshake({ status: 'TECHNICAL', teamAId: 'a', teamBId: 'b' }).state).toBe('confirmed');
		expect(matchHandshake({ status: 'LIVE', teamAId: 'a', teamBId: 'b', winnerTeamId: 'a' }).state).toBe(
			'confirmed'
		);
	});

	it('waits for an opponent when the bracket slot is empty', () => {
		expect(matchHandshake({ status: 'PENDING', teamAId: 'a', teamBId: null })).toMatchObject({
			state: 'waiting_opponent',
			waitingName: 'both'
		});
	});

	it('is ready when both teams are present and nobody reported', () => {
		expect(matchHandshake({ status: 'LIVE', teamAId: 'a', teamBId: 'b' })).toMatchObject({
			state: 'ready',
			waitingName: 'both'
		});
	});

	it('waits for the rival after one captain reports', () => {
		expect(
			matchHandshake({ status: 'LIVE', teamAId: 'a', teamBId: 'b', reportedTeamIds: ['a'] })
		).toMatchObject({ state: 'waiting_rival', waitingName: 'B' });
		expect(
			matchHandshake({ status: 'LIVE', teamAId: 'a', teamBId: 'b', reportedTeamIds: ['b'] })
		).toMatchObject({ state: 'waiting_rival', waitingName: 'A' });
	});

	it('confirms when both captains reported the same pair', () => {
		expect(
			matchHandshake({ status: 'LIVE', teamAId: 'a', teamBId: 'b', reportedTeamIds: ['a', 'b'] }).state
		).toBe('confirmed');
	});
});

describe('applicationLane', () => {
	it('keeps checked-in teams on hold before the cup ends', () => {
		expect(applicationLane('IN_BRACKET', 'PENDING', { tournamentStatus: 'LIVE' })).toBe('hold');
		expect(applicationLane('CHECKED_IN', 'READY', { tournamentStatus: 'LIVE' })).toBe('ready');
	});

	it('moves bracket teams to placed after FINISHED', () => {
		expect(applicationLane('IN_BRACKET', 'PENDING', { tournamentStatus: 'FINISHED' })).toBe('placed');
		expect(applicationLane('CHECKED_IN', 'READY', { tournamentStatus: 'FINISHED' })).toBe('placed');
		expect(applicationLane('APPROVED', 'PENDING', { tournamentStatus: 'FINISHED' })).toBe('out');
		expect(applicationLane('REJECTED', 'PENDING', { tournamentStatus: 'FINISHED' })).toBe('out');
	});

	it('marks every remaining team out when the cup is cancelled', () => {
		expect(applicationLane('IN_BRACKET', 'READY', { tournamentStatus: 'CANCELLED' })).toBe('out');
		expect(applicationLane('SUBMITTED', 'PENDING', { tournamentStatus: 'CANCELLED' })).toBe('out');
	});

	it('labels places from the final', () => {
		expect(applicationPlaceLabel(1)).toBe('1 место');
		expect(applicationPlaceLabel(2)).toBe('2 место');
		expect(applicationPlaceLabel(null)).toBe('Сыграли');
	});
});
