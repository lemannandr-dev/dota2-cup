export type StaffActor = {
	userId: string;
	role: string;
	isOwner: boolean;
	staffRole?: string | null;
};

export function canManageTournamentStaff(actor: StaffActor) {
	if (actor.role === 'ADMIN') return true;
	if (actor.isOwner) return true;
	return actor.staffRole === 'OWNER' || actor.staffRole === 'ADMIN';
}

export function canAssignTournamentReferee(actor: StaffActor) {
	return canManageTournamentStaff(actor);
}

export function canRemoveTournamentStaff(actor: StaffActor, target: { userId: string; staffRole: string; isOwner: boolean }) {
	if (target.isOwner || target.staffRole === 'OWNER') return false;
	return canManageTournamentStaff(actor);
}

export function refereeNotifyIds(ownerId?: string | null, staffIds: string[] = []) {
	return Array.from(new Set([ownerId, ...staffIds].filter((id): id is string => Boolean(id))));
}

export function isSteamId64(raw: string) {
	return /^\d{15,20}$/.test(raw.trim());
}

export type RefereeLookup =
	| { kind: 'userId'; userId: string }
	| { kind: 'steamId'; steamId: string }
	| { kind: 'name'; name: string }
	| { kind: 'empty' }
	| { kind: 'short' };

export function parseRefereeLookup(input: { userId?: string; steamId?: string; query?: string }): RefereeLookup {
	const userId = input.userId?.trim();
	if (userId) return { kind: 'userId', userId };
	const raw = (input.steamId ?? input.query ?? '').trim();
	if (!raw) return { kind: 'empty' };
	if (isSteamId64(raw)) return { kind: 'steamId', steamId: raw };
	if (raw.length < 2) return { kind: 'short' };
	return { kind: 'name', name: raw };
}

export function pickUniqueArenaUser<T extends { displayName: string }>(rows: T[], name: string): T | 'ambiguous' | null {
	const query = name.trim().toLowerCase();
	const exact = rows.filter((row) => row.displayName.toLowerCase() === query);
	if (exact.length === 1) return exact[0];
	if (exact.length > 1) return 'ambiguous';
	if (rows.length === 1) return rows[0];
	if (rows.length > 1) return 'ambiguous';
	return null;
}
