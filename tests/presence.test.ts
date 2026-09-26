import { describe, expect, it } from 'vitest';
import { isLfgCupOpen, mapArenaPlayer, mapLfgCard, sortPartyLfg } from '@/lib/party-search';
import { ARENA_ONLINE_WINDOW_MS, isRecentlyOnline } from '@/lib/presence';

describe('arena presence', () => {
	it('marks a player online only from a recent arena login, not a Dota client', () => {
		const now = Date.parse('2026-08-24T12:00:00.000Z');
		expect(isRecentlyOnline('2026-08-24T11:50:00.000Z', now)).toBe(true);
		expect(isRecentlyOnline(new Date(now - ARENA_ONLINE_WINDOW_MS - 1), now)).toBe(false);
		expect(isRecentlyOnline(null, now)).toBe(false);
	});

	it('puts arena rating on the card and does not invent a Dota medal or Plus badge', () => {
		const card = mapLfgCard({
			id: 'p1',
			roles: [5],
			mmrMin: null,
			mmrMax: null,
			note: 'ищу 5',
			expiresAt: '2026-08-24T18:00:00.000Z',
			createdAt: '2026-08-24T12:00:00.000Z',
			user: {
				id: 'u1',
				displayName: 'Искра',
				steamId: '76561198000000000',
				rating: 1016,
				ratingGames: 1,
				level: 1,
				lastLoginAt: '2026-08-24T11:50:00.000Z'
			}
		}, Date.parse('2026-08-24T12:00:00.000Z'));
		expect(card.isOnline).toBe(true);
		expect(card.rankLabel).toBeNull();
		expect(card.medal).toBeNull();
		expect(card.mmr).toBeNull();
		expect(card.user.rating).toBe(1016);		expect(card.tournament).toBeNull();
	});

	it('shows an OpenDota medal only when a rank tier is passed in', () => {
		const card = mapLfgCard({
			id: 'p-medal',
			roles: [1],
			mmrMin: null,
			mmrMax: null,
			note: null,
			expiresAt: '2026-08-24T18:00:00.000Z',
			createdAt: '2026-08-24T12:00:00.000Z',
			medal: { tier: 'legend', stars: 5 },
			user: { id: 'u3', displayName: 'o555aa', rating: 1000, ratingGames: 0, level: 1 }
		});
		expect(card.medal).toEqual({ tier: 'legend', stars: 5 });
		expect(card.rankLabel).toBe('Легенда V');
	});

	it('keeps an open-cup link on the LFG card and rejects finished cups', () => {
		expect(isLfgCupOpen('REGISTRATION')).toBe(true);
		expect(isLfgCupOpen('LIVE')).toBe(true);
		expect(isLfgCupOpen('FINISHED')).toBe(false);
		const card = mapLfgCard({
			id: 'p2',
			roles: [4],
			mmrMin: null,
			mmrMax: null,
			note: '4/5',
			expiresAt: '2026-08-24T18:00:00.000Z',
			createdAt: '2026-08-24T12:00:00.000Z',
			tournament: { id: 'c1', title: 'Aegis Weekend Clash' },
			user: { id: 'u2', displayName: 'Капитан', rating: 1000, ratingGames: 0, level: 1 }
		});
		expect(card.tournament).toEqual({ id: 'c1', title: 'Aegis Weekend Clash', href: '/tournaments/c1' });
	});

	it('pins the viewer LFG first and maps cached OpenDota MMR without inventing it', () => {
		const ranked = sortPartyLfg(
			[
				{ user: { id: 'a' }, createdAt: '2026-09-04T10:00:00.000Z' },
				{ user: { id: 'me' }, createdAt: '2026-09-04T08:00:00.000Z' }
			],
			'me'
		);
		expect(ranked[0].user.id).toBe('me');
		const player = mapArenaPlayer({
			id: 'o555aa',
			displayName: 'o555aa',
			steamId: '76561198835548729',
			rating: 1000,
			ratingGames: 0,
			level: 1,
			openDotaMmr: 4030,
			openDotaMmrSource: 'estimate'
		});
		expect(player.mmr).toEqual({ value: 4030, source: 'estimate' });
		expect(mapArenaPlayer({ id: 'x', displayName: 'x', rating: 1000, level: 1 }).mmr).toBeNull();
	});
});
