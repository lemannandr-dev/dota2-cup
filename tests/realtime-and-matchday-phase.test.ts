import { describe, expect, it, vi } from 'vitest';
import { coalesceCalls, uniqueTournamentIds } from '@/lib/realtime-client';
import { nextMatchDayAction } from '@/lib/match-day';

describe('realtime client helpers', () => {
	it('uniqueTournamentIds sorts and drops empties', () => {
		expect(uniqueTournamentIds(['b', null, 'a', 'a', undefined, ''])).toEqual(['a', 'b']);
	});

	it('coalesceCalls fires once for a burst', async () => {
		vi.useFakeTimers();
		const fn = vi.fn();
		const trigger = coalesceCalls(fn, 150);
		trigger();
		trigger();
		trigger();
		expect(fn).not.toHaveBeenCalled();
		await vi.advanceTimersByTimeAsync(150);
		expect(fn).toHaveBeenCalledTimes(1);
		trigger.cancel();
		vi.useRealTimers();
	});
});

describe('nextMatchDayAction package E priorities', () => {
	it('NEEDS_ACTION asks captain to fix application', () => {
		const action = nextMatchDayAction({
			tournamentStatus: 'REGISTRATION',
			applicationStatus: 'NEEDS_ACTION'
		});
		expect(action.code).toBe('wait_review');
		expect(action.label).toBe('Исправить заявку');
		expect(action.mustAct).toBe(true);
	});

	it('SUBMITTED stays passive wait', () => {
		const action = nextMatchDayAction({
			tournamentStatus: 'REGISTRATION',
			applicationStatus: 'SUBMITTED'
		});
		expect(action.label).toBe('Ждём решение орга');
		expect(action.mustAct).toBeUndefined();
	});

	it('dispute CTA asks for evidence', () => {
		const action = nextMatchDayAction({
			tournamentStatus: 'LIVE',
			applicationStatus: 'IN_BRACKET',
			openMatch: { status: 'NEEDS_REVIEW', youReported: true, lobbyPosted: true, isCaptain: true }
		});
		expect(action.code).toBe('dispute');
		expect(action.label).toBe('Добавить доказательство');
		expect(action.mustAct).toBe(true);
	});
});
