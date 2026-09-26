import { describe, expect, it } from 'vitest';
import {
	canKickTeamMember,
	canLeaveTeam,
	canMarkSubstitute,
	countMainRoster,
	cupTitleFromInviteMessage,
	inviteAcceptCopy,
	inviteRosterBlock,
	mapRosterSlotPlayers,
	partySearchHref,
	teamRosterLocked
} from '@/lib/team-roster';

describe('team roster policy', () => {
	it('locks after check-in or bracket', () => {
		expect(teamRosterLocked([{ status: 'APPROVED' }])).toBe(false);
		expect(teamRosterLocked([{ status: 'CHECKED_IN' }])).toBe(true);
		expect(teamRosterLocked([{ status: 'IN_BRACKET' }])).toBe(true);
	});

	it('blocks the creator from leaving and anyone after lock', () => {
		expect(canLeaveTeam({ userId: 'p1', createdById: 'cap', locked: false })).toBe(true);
		expect(canLeaveTeam({ userId: 'cap', createdById: 'cap', locked: false })).toBe(false);
		expect(canLeaveTeam({ userId: 'p1', createdById: 'cap', locked: true })).toBe(false);
	});

	it('lets captain kick others, never the creator, never after lock', () => {
		expect(canKickTeamMember({ actorId: 'cap', createdById: 'cap', targetUserId: 'p1', actorIsCaptain: true, locked: false })).toBe(true);
		expect(canKickTeamMember({ actorId: 'cap', createdById: 'cap', targetUserId: 'cap', actorIsCaptain: true, locked: false })).toBe(false);
		expect(canKickTeamMember({ actorId: 'p1', createdById: 'cap', targetUserId: 'p2', actorIsCaptain: false, locked: false })).toBe(false);
		expect(canKickTeamMember({ actorId: 'cap', createdById: 'cap', targetUserId: 'p1', actorIsCaptain: true, locked: true })).toBe(false);
	});

	it('lets captain mark a substitute only before lock', () => {
		expect(canMarkSubstitute({ actorId: 'cap', createdById: 'cap', actorIsCaptain: true, locked: false })).toBe(true);
		expect(canMarkSubstitute({ actorId: 'p1', createdById: 'cap', actorIsCaptain: false, locked: false })).toBe(false);
		expect(canMarkSubstitute({ actorId: 'cap', createdById: 'cap', actorIsCaptain: true, locked: true })).toBe(false);
	});
});

describe('countMainRoster', () => {
	it('counts Steam slots, not just confirmed names', () => {
		const roster = countMainRoster([
			{ confirmed: true, isSubstitute: false, steamId: '1' },
			{ confirmed: true, isSubstitute: false, user: { steamId: '2' } },
			{ confirmed: true, isSubstitute: false, steamId: null },
			{ confirmed: true, isSubstitute: true, steamId: '9' },
			{ confirmed: false, isSubstitute: false, steamId: '8' }
		]);
		expect(roster).toMatchObject({ confirmed: 3, withSteam: 2, needed: 3, full: false, ready: false });
	});

	it('is ready only with five unique Steam mains', () => {
		const five = [1, 2, 3, 4, 5].map((n) => ({ confirmed: true, isSubstitute: false, steamId: String(n) }));
		expect(countMainRoster(five).ready).toBe(true);
		expect(inviteRosterBlock(countMainRoster(five))).toMatch(/уже 5\/5/);
		expect(inviteRosterBlock(countMainRoster([...five.slice(0, 4), { confirmed: true, isSubstitute: false }]))).toMatch(/Замените/);
		expect(inviteRosterBlock(countMainRoster(five.slice(0, 2)))).toBeNull();
	});

	it('maps only confirmed mains and never invents an MMR', () => {
		const players = mapRosterSlotPlayers([
			{
				confirmed: false,
				isSubstitute: false,
				user: { id: 'ghost', displayName: 'ghost', steamId: '1', openDotaMmr: 5000, openDotaMmrSource: 'estimate' }
			},
			{
				confirmed: true,
				isSubstitute: true,
				user: { id: 'bench', displayName: 'bench', steamId: '2', openDotaMmr: 4800, openDotaMmrSource: 'solo' }
			},
			{
				confirmed: true,
				isSubstitute: false,
				user: {
					id: 'o555aa',
					displayName: 'o555aa',
					avatarUrl: 'https://example.com/a.png',
					steamId: '76561198835548729',
					openDotaRankTier: 80,
					openDotaLeaderboard: null,
					openDotaMmr: 4030,
					openDotaMmrSource: 'estimate'
				}
			},
			{
				confirmed: true,
				isSubstitute: false,
				user: { id: 'no-mmr', displayName: 'без кэша', steamId: '3', openDotaMmr: null, openDotaMmrSource: null }
			}
		]);
		expect(players).toHaveLength(2);
		expect(players[0]).toMatchObject({
			id: 'o555aa',
			displayName: 'o555aa',
			hasSteam: true,
			mmr: { value: 4030, source: 'estimate' }
		});
		expect(players[1].mmr).toBeNull();
		expect(players[1].hasSteam).toBe(true);
	});

	it('does not pad empty slots in data — the UI draws the remaining invite cells', () => {
		expect(mapRosterSlotPlayers([])).toEqual([]);
		expect(
			mapRosterSlotPlayers(
				Array.from({ length: 7 }, (_, index) => ({
					confirmed: true,
					isSubstitute: false,
					user: { id: `p${index}`, displayName: `p${index}`, steamId: String(index + 1) }
				}))
			)
		).toHaveLength(5);
	});

	it('keeps team and cup in the party-search link', () => {
		expect(partySearchHref({ teamId: 't1', tournamentId: 'c1' })).toBe('/party-search?tab=players&teamId=t1&tournamentId=c1');
		expect(partySearchHref({ teamId: 't1', playerId: 'p1', q: 'o555aa' })).toBe(
			'/party-search?tab=players&teamId=t1&q=o555aa&playerId=p1'
		);
	});

	it('tells the invitee how many Steam slots remain and which cup', () => {
		expect(inviteAcceptCopy({ confirmed: 3, withSteam: 3, needed: 2, full: false, ready: false }, 'Aegis Weekend Clash')).toContain(
			'ещё 2'
		);
		expect(inviteAcceptCopy({ confirmed: 5, withSteam: 5, needed: 0, full: true, ready: true }, 'Aegis Weekend Clash')).toContain(
			'заявить команду'
		);
		expect(cupTitleFromInviteMessage('Добро пожаловать · Кубок: Aegis Weekend Clash')).toBe('Aegis Weekend Clash');
	});
});
