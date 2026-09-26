import { describe, expect, it } from 'vitest';
import { isMatchSoonWindow, matchSoonNotifyRows } from '@/lib/match-soon';
import { lobbyCopyText } from '@/lib/match-lobby';

describe('match soon window', () => {
	const start = new Date('2026-08-24T18:00:00.000Z');

	it('fires inside 30 minutes and not after start', () => {
		expect(isMatchSoonWindow(start, new Date('2026-08-24T17:35:00.000Z'))).toBe(true);
		expect(isMatchSoonWindow(start, new Date('2026-08-24T17:20:00.000Z'))).toBe(false);
		expect(isMatchSoonWindow(start, new Date('2026-08-24T18:01:00.000Z'))).toBe(false);
	});

	it('notifies unique roster members once per cup link', () => {
		const rows = matchSoonNotifyRows({
			tournamentId: 't1',
			title: 'Aegis Cup',
			userIds: ['cap', 'p1', 'cap']
		});
		expect(rows).toHaveLength(2);
		expect(rows[0]).toMatchObject({
			type: 'MATCH_SOON',
			linkUrl: '/tournaments/t1'
		});
	});
});

describe('lobby copy text', () => {
	it('joins name, password and voice for one tap', () => {
		expect(
			lobbyCopyText({
				name: 'Aegis',
				password: 'radiant',
				region: 'EU East',
				voiceUrl: 'https://discord.gg/room'
			})
		).toBe('Лобби: Aegis\nПароль: radiant\nСервер: EU East\nГолосовой: https://discord.gg/room');
	});
});
