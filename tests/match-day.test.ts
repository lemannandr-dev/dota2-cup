import { describe, expect, it } from 'vitest';
import { buildMatchDayChecklist, matchDayHref, nextMatchDayAction, pickActionTeamId, pickOpenMatch, rosterFromSnapshot } from '@/lib/match-day';

describe('rosterFromSnapshot', () => {
	it('reads a plain array and an array mixed with readiness', () => {
		expect(rosterFromSnapshot([{ userId: 'u1', displayName: 'Aegis' }])).toEqual([
			{ userId: 'u1', displayName: 'Aegis', steamId: null }
		]);
		expect(
			rosterFromSnapshot({
				0: { displayName: 'Pudge' },
				1: { displayName: 'Zeus' },
				readiness: { status: 'READY' }
			})
		).toEqual([
			{ displayName: 'Pudge', steamId: null },
			{ displayName: 'Zeus', steamId: null }
		]);
	});
});

describe('nextMatchDayAction', () => {
	it('asks the captain to check in while the window is open', () => {
		const action = nextMatchDayAction({
			tournamentStatus: 'CHECK_IN',
			applicationStatus: 'APPROVED',
			checkInClosesLabel: '25.08, 19:00'
		});
		expect(action.code).toBe('check_in');
		expect(action.hint).toContain('25.08, 19:00');
	});

	it('explains a missed check-in window', () => {
		expect(
			nextMatchDayAction({
				tournamentStatus: 'LIVE',
				applicationStatus: 'NO_CHECK_IN',
				checkInClosesLabel: '25.08, 19:00'
			}).hint
		).toContain('не отметил до 25.08, 19:00');
	});

	it('asks for readiness only on tournament day', () => {
		expect(
			nextMatchDayAction({
				tournamentStatus: 'LIVE',
				applicationStatus: 'IN_BRACKET',
				readyStatus: 'PENDING',
				startAt: '2026-08-23T12:00:00.000Z',
				now: new Date('2026-08-23T15:00:00.000Z')
			}).code
		).toBe('ready');
		expect(
			nextMatchDayAction({
				tournamentStatus: 'LIVE',
				applicationStatus: 'IN_BRACKET',
				readyStatus: 'PENDING',
				startAt: '2026-08-24T12:00:00.000Z',
				now: new Date('2026-08-23T15:00:00.000Z')
			}).code
		).toBe('wait_start');
	});

	it('prefers the live pair over generic live status', () => {
		expect(
			nextMatchDayAction({
				tournamentStatus: 'LIVE',
				applicationStatus: 'IN_BRACKET',
				readyStatus: 'READY',
				openMatch: { status: 'SCHEDULED', youReported: false, isCaptain: true, lobbyPosted: false }
			}).code
		).toBe('post_lobby');
		expect(
			nextMatchDayAction({
				tournamentStatus: 'LIVE',
				applicationStatus: 'IN_BRACKET',
				readyStatus: 'READY',
				openMatch: { status: 'SCHEDULED', youReported: false, isCaptain: false, lobbyPosted: false }
			}).code
		).toBe('wait_lobby');
		expect(
			nextMatchDayAction({
				tournamentStatus: 'LIVE',
				applicationStatus: 'IN_BRACKET',
				readyStatus: 'READY',
				openMatch: { status: 'SCHEDULED', youReported: false, isCaptain: false, lobbyPosted: true }
			}).code
		).toBe('join_lobby');
		expect(
			nextMatchDayAction({
				tournamentStatus: 'LIVE',
				applicationStatus: 'IN_BRACKET',
				readyStatus: 'READY',
				openMatch: { status: 'SCHEDULED', youReported: false, isCaptain: true, lobbyPosted: true }
			}).code
		).toBe('report');
		expect(
			nextMatchDayAction({
				tournamentStatus: 'LIVE',
				applicationStatus: 'IN_BRACKET',
				readyStatus: 'READY',
				openMatch: { status: 'SCHEDULED', youReported: true }
			}).code
		).toBe('wait_rival');
		expect(
			nextMatchDayAction({
				tournamentStatus: 'LIVE',
				applicationStatus: 'IN_BRACKET',
				readyStatus: 'READY',
				openMatch: { status: 'NEEDS_REVIEW', youReported: true }
			}).code
		).toBe('dispute');
		expect(
			nextMatchDayAction({
				tournamentStatus: 'LIVE',
				applicationStatus: 'IN_BRACKET',
				readyStatus: 'READY',
				lastClosed: { won: true }
			}).code
		).toBe('recap');
	});
});

describe('buildMatchDayChecklist', () => {
	it('marks lobby as current when the captain must post it', () => {
		const steps = buildMatchDayChecklist({
			tournamentStatus: 'LIVE',
			applicationStatus: 'IN_BRACKET',
			readyStatus: 'READY',
			openMatch: { status: 'SCHEDULED', youReported: false, isCaptain: true, lobbyPosted: false }
		});
		expect(steps.find((step) => step.id === 'lobby')?.state).toBe('current');
		expect(steps.find((step) => step.id === 'check_in')?.state).toBe('done');
	});
});

describe('matchDayHref', () => {
	it('jumps to the pair when the step is lobby or score', () => {
		expect(matchDayHref('/tournaments/t1', 'post_lobby', 'm1')).toBe('/tournaments/t1#match-m1');
		expect(matchDayHref('/tournaments/t1#match-m1', 'report', 'm1')).toBe('/tournaments/t1#match-m1');
		expect(matchDayHref('#match-m1', 'dispute', 'm1')).toBe('#match-m1');
		expect(matchDayHref('/tournaments/t1', 'check_in', 'm1')).toBe('/tournaments/t1');
	});
});

describe('pickActionTeamId', () => {
	it('uses the team that actually has an application, not the first captain team', () => {
		expect(
			pickActionTeamId(
				[{ id: 'other' }, { id: 'iskry' }],
				[{ teamId: 'iskry' }]
			)
		).toBe('iskry');
	});
});

describe('pickOpenMatch', () => {
	it('prefers a dispute, then an unfinished pair', () => {
		expect(
			pickOpenMatch([
				{ status: 'COMPLETED', winnerTeamId: 'a' },
				{ status: 'SCHEDULED', winnerTeamId: null },
				{ status: 'NEEDS_REVIEW', winnerTeamId: null }
			])?.status
		).toBe('NEEDS_REVIEW');
	});
});
