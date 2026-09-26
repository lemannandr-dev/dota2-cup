export const ARENA_ONLINE_WINDOW_MS = 15 * 60 * 1000;

export function isRecentlyOnline(
	lastLoginAt?: Date | string | null,
	now = Date.now(),
	windowMs = ARENA_ONLINE_WINDOW_MS
) {
	if (!lastLoginAt) return false;
	const at = typeof lastLoginAt === 'string' ? Date.parse(lastLoginAt) : lastLoginAt.getTime();
	if (Number.isNaN(at)) return false;
	return now - at <= windowMs;
}
