export const ADMIN_USER_FILTERS = ['all', 'steam', 'nosteam', 'nokey', 'staff', 'balance'] as const;
export type AdminUserFilter = (typeof ADMIN_USER_FILTERS)[number];

export type AdminUserRow = {
	id: string;
	userId?: string | null;
	displayName: string;
	username?: string | null;
	email?: string | null;
	role: string;
	steamId?: string | null;
	balance: number;
	totpEnabledAt?: string | null;
	avatarUrl?: string | null;
	lastLoginAt?: string | null;
};

const STAFF_ROLES = new Set(['ADMIN', 'ORGANIZER', 'REFEREE']);
const ARENA_MS = 15 * 60 * 1000;

export function isAdminUserFilter(value: string | null): value is AdminUserFilter {
	return ADMIN_USER_FILTERS.some((row) => row === value);
}

export function adminUserOnArena(lastLoginAt: string | null | undefined, now = Date.now()) {
	if (!lastLoginAt) return false;
	const time = new Date(lastLoginAt).getTime();
	if (!Number.isFinite(time)) return false;
	const age = now - time;
	return age >= 0 && age <= ARENA_MS;
}

export function adminUserMatchesQuery(user: AdminUserRow, q: string) {
	const needle = q.trim().toLowerCase();
	if (!needle) return true;
	return [user.displayName, user.username, user.email, user.steamId, user.userId, user.id].some((value) =>
		value?.toLowerCase().includes(needle)
	);
}

export function adminUserPassesFilter(user: AdminUserRow, filter: AdminUserFilter) {
	if (filter === 'steam') return Boolean(user.steamId);
	if (filter === 'nosteam') return !user.steamId;
	if (filter === 'nokey') return !user.totpEnabledAt;
	if (filter === 'staff') return STAFF_ROLES.has(user.role);
	if (filter === 'balance') return user.balance !== 0;
	return true;
}

export function filterAdminUsers(users: AdminUserRow[], filter: AdminUserFilter, q = '') {
	return users.filter((user) => adminUserMatchesQuery(user, q) && adminUserPassesFilter(user, filter));
}

export function adminUserCounts(users: AdminUserRow[]) {
	return {
		all: users.length,
		steam: users.filter((user) => Boolean(user.steamId)).length,
		nosteam: users.filter((user) => !user.steamId).length,
		nokey: users.filter((user) => !user.totpEnabledAt).length,
		staff: users.filter((user) => STAFF_ROLES.has(user.role)).length,
		balance: users.filter((user) => user.balance !== 0).length
	};
}
