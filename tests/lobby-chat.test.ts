import { describe, expect, it } from 'vitest';
import {
	insertLobbyMention,
	mentionIds,
	mentionQueryAt,
	rewriteLobbyMentions,
	sanitizeLobbyBody,
	splitLobbyBody
} from '@/lib/lobby-chat';
import { readLobbyTicket, signLobbyTicket } from '@/lib/lobby-ticket';

describe('lobby chat text', () => {
	it('strips markup and keeps a mention token', () => {
		const clean = sanitizeLobbyBody('  привет <script>alert(1)</script>  ');
		expect(clean).toBe('привет scriptalert(1)/script');
		expect(clean.includes('<')).toBe(false);
	});

	it('rewrites a mention only for a known profile', () => {
		const raw = 'смотри @[чужой](cmo555aa0000000000000001) и @[нет](cmo555aa0000000000000002)';
		const stored = rewriteLobbyMentions(raw, new Map([['cmo555aa0000000000000001', 'Hotel [carry]']]));
		expect(mentionIds(stored)).toEqual(['cmo555aa0000000000000001']);
		expect(stored).toContain('@[Hotel carry](cmo555aa0000000000000001)');
		expect(splitLobbyBody(stored).some((part) => part.type === 'mention' && part.name === 'Hotel carry')).toBe(true);
	});

	it('inserts a profile token at the @ query', () => {
		const next = insertLobbyMention('привет @hot', 12, { id: 'cmo555aa0000000000000001', displayName: 'Hotel' });
		expect(next.value).toBe('привет @[Hotel](cmo555aa0000000000000001) ');
		expect(mentionQueryAt('привет @hot', 12)).toBe('hot');
		expect(mentionQueryAt(next.value, next.caret)).toBe(null);
	});
});

describe('lobby ticket', () => {
	const user = { id: 'cmo555aa0000000000000001', displayName: 'o555aa', avatarUrl: 'https://steam/a.jpg' };

	it('round-trips a signed ticket and rejects tampering', () => {
		const token = signLobbyTicket(user, 'secret', 1_000);
		expect(token).toBeTruthy();
		expect(readLobbyTicket(token || '', 'secret', 1_000)?.sub).toBe(user.id);
		expect(readLobbyTicket(token || '', 'other', 1_000)).toBe(null);
		expect(readLobbyTicket(`${token?.slice(0, -1)}x`, 'secret', 1_000)).toBe(null);
		expect(readLobbyTicket(token || '', 'secret', 1_000 + 7 * 60 * 60 * 1000)).toBe(null);
	});
});
