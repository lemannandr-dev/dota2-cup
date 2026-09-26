export const TEAM_ROLE_DEPUTY = 'deputy';

export function deputyIdFromMembers(
	members: Array<{ userId: string; role?: string | null; confirmed?: boolean }>,
	createdById: string
): string | null {
	const row = members.find(
		(member) => member.confirmed !== false && member.role === TEAM_ROLE_DEPUTY && member.userId !== createdById
	);
	return row?.userId ?? null;
}

export function canActForTeam(userId: string, createdById?: string | null, deputyId?: string | null) {
	return Boolean(userId && (userId === createdById || userId === deputyId));
}

export function rosterBadge(userId: string, createdById?: string | null, deputyId?: string | null): 'captain' | 'deputy' | null {
	if (userId === createdById) return 'captain';
	if (userId === deputyId) return 'deputy';
	return null;
}

export function invitePositionLabel(position?: number | null) {
	if (!position || position < 1 || position > 5) return null;
	const names = ['', 'керри', 'мид', 'оффлейн', 'поддержка', 'полная поддержка'];
	return `${position} · ${names[position]}`;
}
