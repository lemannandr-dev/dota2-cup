import { describe, expect, it } from 'vitest';
import {
	canAssignTournamentReferee,
	canRemoveTournamentStaff,
	isSteamId64,
	parseRefereeLookup,
	pickUniqueArenaUser,
	refereeNotifyIds
} from '@/lib/staff-policy';

const owner = { userId: 'org', role: 'USER', isOwner: true, staffRole: 'OWNER' };
const referee = { userId: 'ref', role: 'USER', isOwner: false, staffRole: 'REFEREE' };
const stranger = { userId: 'x', role: 'USER', isOwner: false, staffRole: null };

describe('tournament staff gates', () => {
	it('lets only the organizer or site admin appoint a referee', () => {
		expect(canAssignTournamentReferee(owner)).toBe(true);
		expect(canAssignTournamentReferee({ ...stranger, role: 'ADMIN' })).toBe(true);
		expect(canAssignTournamentReferee(referee)).toBe(false);
		expect(canAssignTournamentReferee(stranger)).toBe(false);
	});

	it('blocks removing the tournament owner', () => {
		expect(canRemoveTournamentStaff(owner, { userId: 'org', staffRole: 'OWNER', isOwner: true })).toBe(false);
		expect(canRemoveTournamentStaff(owner, { userId: 'ref', staffRole: 'REFEREE', isOwner: false })).toBe(true);
		expect(canRemoveTournamentStaff(stranger, { userId: 'ref', staffRole: 'REFEREE', isOwner: false })).toBe(false);
	});

	it('accepts SteamID64 and unique referee ids', () => {
		expect(isSteamId64('76561198000000000')).toBe(true);
		expect(isSteamId64('not-steam')).toBe(false);
		expect(refereeNotifyIds('org', ['ref', 'org'])).toEqual(['org', 'ref']);
	});

	it('resolves a referee by user id, SteamID64 or unique display name', () => {
		expect(parseRefereeLookup({ userId: 'u1' })).toEqual({ kind: 'userId', userId: 'u1' });
		expect(parseRefereeLookup({ query: '76561198000000000' })).toEqual({
			kind: 'steamId',
			steamId: '76561198000000000'
		});
		expect(parseRefereeLookup({ query: 'Искра' })).toEqual({ kind: 'name', name: 'Искра' });
		expect(parseRefereeLookup({ query: 'x' })).toEqual({ kind: 'short' });
		expect(
			pickUniqueArenaUser(
				[
					{ displayName: 'Искра' },
					{ displayName: 'Кузница' }
				],
				'искра'
			)
		).toEqual({ displayName: 'Искра' });
		expect(
			pickUniqueArenaUser(
				[
					{ displayName: 'Искра' },
					{ displayName: 'Искра Два' }
				],
				'иск'
			)
		).toBe('ambiguous');
	});
});
