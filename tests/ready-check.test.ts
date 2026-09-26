import { describe, expect, it } from 'vitest';
import { buildReadyCheck, padReadySlots, playersForReadyStrip, readySidesDisjoint } from '@/lib/ready-check';

describe('ready check strip', () => {
	it('paints all five of a ready team green and leaves empty slots dark', () => {
		const slots = padReadySlots(
			[
				{ displayName: 'Aegis', avatarUrl: 'https://example.com/a.png' },
				{ displayName: 'Pudge' }
			],
			'READY'
		);
		expect(slots).toHaveLength(5);
		expect(slots[0]).toMatchObject({ displayName: 'Aegis', state: 'ready' });
		expect(slots[1]?.state).toBe('ready');
		expect(slots[4]).toEqual({ displayName: null, avatarUrl: null, state: 'empty' });
	});

	it('counts team confirmation, not a fake 9/10 accept', () => {
		const board = buildReadyCheck({
			teamA: {
				name: 'Искры',
				readyStatus: 'READY',
				players: ['A', 'B', 'C', 'D', 'E'].map((name) => ({ displayName: name }))
			},
			teamB: {
				name: 'Кузница',
				readyStatus: 'PENDING',
				players: ['F', 'G', 'H', 'I', 'J'].map((name) => ({ displayName: name }))
			}
		});
		expect(board.readyCount).toBe(5);
		expect(board.total).toBe(10);
		expect(board.sideB.slots.every((slot) => slot.state === 'pending')).toBe(true);
		expect(board.hint).toContain('не accept');
	});

	it('falls back to confirmed members when the snapshot has no five', () => {
		expect(
			playersForReadyStrip([], [
				{ displayName: 'Aegis', avatarUrl: 'https://a', confirmed: true, userId: 'u1', rankLabel: 'Легенда III' },
				{ displayName: 'Bench', confirmed: true, isSubstitute: true }
			])
		).toEqual([
			{
				displayName: 'Aegis',
				avatarUrl: 'https://a',
				userId: 'u1',
				profileHref: '/profile/u1',
				rankLabel: 'Легенда III',
				medal: null
			}
		]);
	});

	it('keeps sides disjoint — no shared nicknames between teams', () => {
		const board = buildReadyCheck({
			teamA: {
				name: 'Кузница',
				readyStatus: 'READY',
				players: ['A1', 'A2', 'A3', 'A4', 'A5'].map((name, index) => ({
					displayName: name,
					avatarUrl: null,
					userId: `a${index}`
				}))
			},
			teamB: {
				name: 'Искры',
				readyStatus: 'READY',
				players: ['B1', 'B2', 'B3', 'B4', 'B5'].map((name, index) => ({
					displayName: name,
					avatarUrl: null,
					userId: `b${index}`
				}))
			}
		});
		expect(readySidesDisjoint(board)).toBe(true);
		const leak = buildReadyCheck({
			teamA: { name: 'A', players: [{ displayName: 'Same', avatarUrl: null, userId: 'x' }] },
			teamB: { name: 'B', players: [{ displayName: 'Same', avatarUrl: null, userId: 'x' }] }
		});
		expect(readySidesDisjoint(leak)).toBe(false);
	});
});
