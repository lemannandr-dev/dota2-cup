import { redis } from '@/lib/connections';

async function ready(): Promise<boolean> {
	try {
		if (!process.env.REDIS_URL) return false;
		if (!redis.isOpen) await redis.connect();
		return redis.isOpen;
	} catch {
		return false;
	}
}

export async function getCachedJson<T>(key: string): Promise<T | null> {
	if (!(await ready())) return null;
	try {
		const raw = await redis.get(key);
		return raw ? (JSON.parse(raw) as T) : null;
	} catch {
		return null;
	}
}

export async function setCachedJson(key: string, value: unknown, ttlSeconds: number): Promise<void> {
	if (!(await ready())) return;
	try {
		await redis.set(key, JSON.stringify(value), { EX: ttlSeconds });
	} catch {
		/* ignore cache write failures */
	}
}

export async function getWindowCount(key: string): Promise<number> {
	if (!(await ready())) return -1;
	try {
		const raw = await redis.get(key);
		if (raw == null) return 0;
		const count = Number(raw);
		return Number.isFinite(count) ? count : 0;
	} catch {
		return -1;
	}
}

export async function incrWindow(key: string, windowSeconds: number): Promise<number> {
	if (!(await ready())) return -1;
	try {
		const count = await redis.incr(key);
		if (count === 1) await redis.expire(key, windowSeconds);
		return count;
	} catch {
		return -1;
	}
}

export async function publishChannel(channel: string, payload: unknown): Promise<void> {
	if (!(await ready())) return;
	try {
		await redis.publish(channel, JSON.stringify(payload));
	} catch {
		/* ignore */
	}
}

export async function addToSet(key: string, member: string): Promise<boolean> {
	if (!(await ready())) return false;
	try {
		await redis.sAdd(key, member);
		return true;
	} catch {
		return false;
	}
}

export async function removeFromSet(key: string, member: string): Promise<void> {
	if (!(await ready())) return;
	try {
		await redis.sRem(key, member);
	} catch {
		/* ignore */
	}
}

export async function listSet(key: string): Promise<string[]> {
	if (!(await ready())) return [];
	try {
		return await redis.sMembers(key);
	} catch {
		return [];
	}
}

export async function acquireLock(key: string, ttlSeconds: number): Promise<boolean> {
	if (!(await ready())) return false;
	try {
		const result = await redis.set(key, '1', { NX: true, EX: ttlSeconds });
		return result === 'OK';
	} catch {
		return false;
	}
}

export async function releaseLock(key: string): Promise<void> {
	if (!(await ready())) return;
	try {
		await redis.del(key);
	} catch {
		/* ignore */
	}
}
