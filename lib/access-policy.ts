export function isSteamCorridorUser(user: { steamId?: string | null } | null | undefined): user is { steamId: string } {
	return Boolean(user?.steamId);
}

export function canActOnMatch(
	userId: string,
	captainAId?: string | null,
	captainBId?: string | null,
	deputyAId?: string | null,
	deputyBId?: string | null
) {
	return userId === captainAId || userId === captainBId || userId === deputyAId || userId === deputyBId;
}

export function canSubmitMatchScore(
	userId: string,
	captainAId?: string | null,
	captainBId?: string | null,
	deputyAId?: string | null,
	deputyBId?: string | null
) {
	return canActOnMatch(userId, captainAId, captainBId, deputyAId, deputyBId);
}

export { canPostMatchLobby, canViewMatchLobby } from '@/lib/match-lobby';

export function canSubmitTeamApplication(userId: string, captainId: string) {
	return userId === captainId;
}

export function canSwapTournamentRoster(userId: string, captainId: string, isStaff: boolean) {
	return isStaff || userId === captainId;
}

export { canKickTeamMember, canLeaveTeam, canMarkSubstitute, teamRosterLocked } from '@/lib/team-roster';

export function canRespondInvite(userId: string, toUserId: string) {
	return userId === toUserId;
}

export function canRespondChallenge(userId: string, toUserId: string) {
	return userId === toUserId;
}

export { canAssignTournamentReferee, canRemoveTournamentStaff } from '@/lib/staff-policy';

export function canChangeUserRole(actorRole: string) {
	return actorRole === 'ADMIN';
}

export function canUploadDisputeEvidence(input: {
	userId: string;
	role: string;
	captainAId?: string | null;
	captainBId?: string | null;
	isReferee: boolean;
}) {
	if (input.role === 'ADMIN' || input.isReferee) return true;
	return canActOnMatch(input.userId, input.captainAId, input.captainBId);
}

export function canViewDisputeEvidence(input: {
	userId: string;
	role: string;
	captainAId?: string | null;
	captainBId?: string | null;
	isReferee: boolean;
}) {
	return canUploadDisputeEvidence(input);
}

export function isAllowedEvidenceImage(mime: string) {
	return mime === 'image/png' || mime === 'image/jpeg' || mime === 'image/webp';
}

export function isAllowedVodUrl(raw: string) {
	try {
		const url = new URL(raw);
		if (url.protocol !== 'https:') return false;
		const host = url.hostname.toLowerCase();
		return (
			host === 'youtube.com' ||
			host === 'www.youtube.com' ||
			host === 'youtu.be' ||
			host === 'twitch.tv' ||
			host === 'www.twitch.tv' ||
			host === 'clips.twitch.tv'
		);
	} catch {
		return false;
	}
}
