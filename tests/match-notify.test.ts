import { describe, expect, it } from 'vitest';
import { matchNotifyRows, otherCaptainId } from '@/lib/match-notify';

const sides = {
	teamA: { createdById: 'cap-a', name: 'Radiant Five' },
	teamB: { createdById: 'cap-b', name: 'Dire Five' }
};

describe('otherCaptainId', () => {
	it('returns the opposite captain', () => {
		expect(otherCaptainId('cap-a', sides.teamA, sides.teamB)).toBe('cap-b');
		expect(otherCaptainId('cap-b', sides.teamA, sides.teamB)).toBe('cap-a');
		expect(otherCaptainId('staff', sides.teamA, sides.teamB)).toBeNull();
	});
});

describe('matchNotifyRows', () => {
	const base = {
		actorId: 'cap-a',
		tournamentId: 't1',
		tournamentTitle: 'Aegis Cup',
		ownerId: 'org-1',
		...sides,
		scoreA: 2,
		scoreB: 1
	};

	it('tells the opposite captain to confirm a waiting report', () => {
		const rows = matchNotifyRows({ ...base, kind: 'score_waiting' });
		expect(rows).toHaveLength(1);
		expect(rows[0]).toMatchObject({
			userId: 'cap-b',
			type: 'MATCH_REPORT',
			linkUrl: '/tournaments/t1'
		});
		expect(rows[0].body).toContain('2:1');
	});

	it('notifies the rival and the organizer on a score dispute', () => {
		const rows = matchNotifyRows({ ...base, kind: 'score_dispute' });
		expect(rows.map((row) => row.userId).sort()).toEqual(['cap-b', 'org-1']);
		expect(rows.every((row) => row.type === 'MATCH_DISPUTE')).toBe(true);
	});

	it('also writes appointed referees and deep-links the pair', () => {
		const rows = matchNotifyRows({
			...base,
			kind: 'dispute_opened',
			matchId: 'm9',
			refereeIds: ['ref-1', 'org-1']
		});
		expect(rows.map((row) => row.userId).sort()).toEqual(['cap-b', 'org-1', 'ref-1']);
		expect(rows.every((row) => row.linkUrl === '/tournaments/t1#match-m9')).toBe(true);
	});

	it('does not notify the actor, even if they own the tournament', () => {
		const rows = matchNotifyRows({
			...base,
			kind: 'score_forced',
			actorId: 'org-1',
			ownerId: 'org-1'
		});
		expect(rows.map((row) => row.userId).sort()).toEqual(['cap-a', 'cap-b']);
	});

	it('writes the judge resolution for both captains', () => {
		const rows = matchNotifyRows({
			...base,
			kind: 'dispute_resolved',
			actorId: 'org-1',
			resolution: 'Засчитываю 2:1 в пользу Radiant Five'
		});
		expect(rows).toHaveLength(2);
		expect(rows[0].body).toContain('Засчитываю 2:1');
	});
});
