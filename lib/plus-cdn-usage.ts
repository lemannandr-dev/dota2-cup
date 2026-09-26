import { getWindowCount, incrWindow } from '@/server/cache/redis';
import { PLUS_CDN_WINDOW_SECONDS, plusCdnKey } from '@/lib/plus-cdn-limit';

const memory = new Map<string, { count: number; resetAt: number }>();

export async function readPlusCdnUsed(userId: string) {
	const key = plusCdnKey(userId);
	const redisCount = await getWindowCount(key);
	if (redisCount >= 0) return redisCount;
	const row = memory.get(key);
	if (!row || row.resetAt < Date.now()) return 0;
	return row.count;
}

export async function addPlusCdnDownloads(userId: string, count: number) {
	if (count <= 0) return readPlusCdnUsed(userId);
	const key = plusCdnKey(userId);
	let last = -1;
	for (let i = 0; i < count; i++) {
		last = await incrWindow(key, PLUS_CDN_WINDOW_SECONDS);
	}
	if (last >= 0) return last;

	const now = Date.now();
	const current = memory.get(key);
	if (!current || current.resetAt < now) {
		memory.set(key, { count, resetAt: now + PLUS_CDN_WINDOW_SECONDS * 1000 });
		return count;
	}
	current.count += count;
	return current.count;
}
