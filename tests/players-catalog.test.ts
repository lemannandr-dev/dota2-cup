import { describe, expect, it } from 'vitest';
import {
	catalogInviteHint,
	catalogInviteHref,
	catalogLfgLine,
	catalogMatchesFilter,
	catalogOpenCupHint,
	catalogPlayerLine,
	catalogCupKind,
	catalogTeamRoleLabel,
	mapCatalogPlayer,
	slimCatalogCup,
	pickCatalogOpenCup,
	pickCatalogPlayerTeam,
	sortCatalogPlayers
} from '@/lib/players-catalog';

describe('players catalog', () => {
	it('does not invent OpenDota MMR and keeps arena rating separate', () => {
		const withCache = mapCatalogPlayer({
			id: 'o555aa',
			displayName: 'o555aa',
			steamId: '76561198835548729',
			rating: 1000,
			ratingGames: 0,
			openDotaMmr: 4030,
			openDotaMmrSource: 'estimate'
		});
		expect(withCache.mmr).toEqual({ value: 4030, source: 'estimate' });
		expect(catalogPlayerLine(withCache)).toBe('MMR 4030 · арена нет игр');

		const noCache = mapCatalogPlayer({
			id: 'p2',
			displayName: 'без кэша',
			steamId: '3',
			rating: 1016,
			ratingGames: 1
		});
		expect(noCache.mmr).toBeNull();
		expect(catalogPlayerLine(noCache)).toBe('без MMR · арена 1016 · 1 игр');
	});

	it('puts recent arena presence first, then rated players, and never a free-for-all filter', () => {
		const rows = sortCatalogPlayers([
			{ online: false, lastLoginAt: '2026-09-01T00:00:00.000Z', ratingGames: 4, displayName: 'Старый' },
			{ online: true, lastLoginAt: '2026-09-04T07:00:00.000Z', ratingGames: 0, displayName: 'o555aa' },
			{ online: false, lastLoginAt: '2026-09-03T00:00:00.000Z', ratingGames: 0, displayName: 'Новый' }
		]);
		expect(rows.map((row) => row.displayName)).toEqual(['o555aa', 'Старый', 'Новый']);
		expect(catalogMatchesFilter({ online: true, ratingGames: 0, steamId: '1', lfg: null, championships: [] }, 'LFG')).toBe(false);
		expect(
			catalogMatchesFilter(
				{ online: false, ratingGames: 0, steamId: '1', lfg: { id: 'l1', note: '5', roles: [5], cupTitle: null }, championships: [] },
				'LFG'
			)
		).toBe(true);
	});

	it('picks the captain team and an actually open cup, not a withdrawn one', () => {
		const picked = pickCatalogPlayerTeam(
			[
				{ userId: 'u1', role: 'member', isSubstitute: false, team: { id: 'bench', createdById: 'other' } },
				{ userId: 'u1', role: 'captain', isSubstitute: false, team: { id: 'main', createdById: 'u1' } }
			],
			'u1'
		);
		expect(picked?.team.id).toBe('main');
		expect(
			pickCatalogPlayerTeam(
				[
					{
						userId: 'u1',
						role: 'captain',
						isSubstitute: false,
						team: {
							id: 'idle',
							name: 'Искры Древнего',
							createdById: 'u1',
							applications: [{ status: 'APPROVED', tournament: { status: 'FINISHED' } }]
						}
					},
					{
						userId: 'u1',
						role: 'captain',
						isSubstitute: false,
						team: {
							id: 'live',
							name: 'Контроль рун',
							createdById: 'u1',
							applications: [{ status: 'IN_BRACKET', tournament: { status: 'LIVE' } }]
						}
					}
				],
				'u1'
			)?.team.id
		).toBe('live');
		expect(catalogTeamRoleLabel({ isCaptain: true })).toBe('капитан');
		expect(
			pickCatalogOpenCup([
				{ status: 'WITHDRAWN', tournament: { status: 'REGISTRATION' } },
				{ status: 'IN_BRACKET', tournament: { status: 'LIVE' } },
				{ status: 'APPROVED', tournament: { status: 'FINISHED' } }
			])?.status
		).toBe('IN_BRACKET');
		expect(catalogOpenCupHint({ teamName: 'Контроль рун', applicationStatus: 'IN_BRACKET', cupStatus: 'LIVE', cupTitle: 'Aegis Weekend Clash' })).toBe(
			'«Контроль рун» в сетке «Aegis Weekend Clash»'
		);
	});

	it('writes an invite link with the player, or refuses without a team / Steam', () => {
		expect(catalogInviteHint({ isSelf: true, canInvite: true, steamId: '1' })).toMatch(/ваша визитка/i);
		expect(catalogInviteHint({ isSelf: false, canInvite: false, steamId: '1' })).toBe('Сначала своя пятёрка');
		expect(
			catalogInviteHref({
				playerId: 'p1',
				displayName: 'Искра',
				viewer: { id: 'cap', canInvite: true, inviteTeamId: 't1' },
				steamId: '7656'
			})
		).toBe('/party-search?tab=players&teamId=t1&q=%D0%98%D1%81%D0%BA%D1%80%D0%B0&playerId=p1');
		expect(
			catalogInviteHref({
				playerId: 'p1',
				displayName: 'Искра',
				viewer: { id: 'cap', canInvite: false, inviteTeamId: null },
				steamId: '7656'
			})
		).toBeNull();
		expect(catalogLfgLine({ id: 'l1', note: 'нужна 5', roles: [5], cupTitle: 'Clash' })).toContain('нужна 5');
	});

	it('keeps a real cup story on the mark, not an empty slogan', () => {
		expect(catalogCupKind({ showcase: true, dryRun: false })).toBe('Витрина');
		expect(
			slimCatalogCup({
				tournamentId: 'c1',
				href: '/tournaments/c1/cup',
				year: 2026,
				title: 'Витрина кубка Aegis 2026',
				engraving: 'Тестовая пятёрка Aegis',
				winnerTeamName: 'Тестовая пятёрка Aegis',
				showcase: true,
				dryRun: false,
				trophy: { description: 'Чемпионы «Тестовая пятёрка Aegis»: o555aa' }
			}).description
		).toContain('o555aa');
	});
});
