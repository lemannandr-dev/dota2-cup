import { describe, expect, it } from 'vitest';
import {
	isSteamCorridorUser,
	canChangeUserRole,
	canRespondChallenge,
	canRespondInvite,
	canSubmitMatchScore,
	canSubmitTeamApplication,
	canSwapTournamentRoster,
	canPostMatchLobby,
	canViewMatchLobby,
	canAssignTournamentReferee,
	canUploadDisputeEvidence,
	canViewDisputeEvidence,
	isAllowedEvidenceImage,
	isAllowedVodUrl
} from '@/lib/access-policy';

describe('IDOR gates', () => {
	it('blocks a stranger from reporting another pair', () => {
		expect(canSubmitMatchScore('stranger', 'capA', 'capB')).toBe(false);
		expect(canSubmitMatchScore('capA', 'capA', 'capB')).toBe(true);
		expect(canSubmitMatchScore('depA', 'capA', 'capB', 'depA', null)).toBe(true);
		expect(canPostMatchLobby('depB', 'capA', 'capB', false, null, 'depB')).toBe(true);
	});

	it('blocks a stranger from submitting or withdrawing a team application', () => {
		expect(canSubmitTeamApplication('stranger', 'captain')).toBe(false);
		expect(canSubmitTeamApplication('captain', 'captain')).toBe(true);
	});

	it('hides the lobby password from a stranger', () => {
		expect(canPostMatchLobby('stranger', 'capA', 'capB', false)).toBe(false);
		expect(canViewMatchLobby('stranger', ['capA', 'player'], false)).toBe(false);
		expect(canViewMatchLobby('player', ['capA', 'player'], false)).toBe(true);
	});

	it('blocks a stranger from swapping another team’s roster', () => {
		expect(canSwapTournamentRoster('stranger', 'captain', false)).toBe(false);
		expect(canSwapTournamentRoster('captain', 'captain', false)).toBe(true);
		expect(canSwapTournamentRoster('staff', 'captain', true)).toBe(true);
	});

	it('blocks answering someone else’s invite or challenge', () => {
		expect(canRespondInvite('stranger', 'invitee')).toBe(false);
		expect(canRespondInvite('invitee', 'invitee')).toBe(true);
		expect(canRespondChallenge('stranger', 'leader')).toBe(false);
		expect(canRespondChallenge('leader', 'leader')).toBe(true);
	});

	it('lets only a participant or referee see dispute evidence', () => {
		const stranger = {
			userId: 'x',
			role: 'USER',
			captainAId: 'a',
			captainBId: 'b',
			isReferee: false
		};
		expect(canViewDisputeEvidence(stranger)).toBe(false);
		expect(canUploadDisputeEvidence(stranger)).toBe(false);
		expect(canViewDisputeEvidence({ ...stranger, userId: 'a' })).toBe(true);
		expect(canViewDisputeEvidence({ ...stranger, role: 'ADMIN' })).toBe(true);
		expect(canViewDisputeEvidence({ ...stranger, isReferee: true })).toBe(true);
	});

	it('blocks a stranger from appointing a tournament referee', () => {
		expect(canAssignTournamentReferee({ userId: 'x', role: 'USER', isOwner: false })).toBe(false);
		expect(canAssignTournamentReferee({ userId: 'org', role: 'USER', isOwner: true })).toBe(true);
	});

	it('does not treat an email-only NextAuth user as a corridor actor', () => {
		expect(isSteamCorridorUser({ steamId: null })).toBe(false);
		expect(isSteamCorridorUser({ steamId: '76561198835548729' })).toBe(true);
	});

	it('lets only ADMIN change roles', () => {
		expect(canChangeUserRole('USER')).toBe(false);
		expect(canChangeUserRole('ORGANIZER')).toBe(false);
		expect(canChangeUserRole('ADMIN')).toBe(true);
	});

	it('accepts only image files and https YouTube/Twitch VODs', () => {
		expect(isAllowedEvidenceImage('image/png')).toBe(true);
		expect(isAllowedEvidenceImage('application/pdf')).toBe(false);
		expect(isAllowedVodUrl('https://www.youtube.com/watch?v=abc')).toBe(true);
		expect(isAllowedVodUrl('https://example.com/secret')).toBe(false);
		expect(isAllowedVodUrl('http://youtube.com/watch?v=abc')).toBe(false);
	});
});
