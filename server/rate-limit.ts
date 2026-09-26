import { incrWindow } from '@/server/cache/redis';
import { DomainError } from '@/server/errors';

const memory = new Map<string, { count: number; resetAt: number }>();

export async function assertRateLimit(key: string, max: number, windowSeconds: number) {
	const redisCount = await incrWindow(key, windowSeconds);
	if (redisCount >= 0) {
		if (redisCount > max) throw new DomainError('Слишком много запросов, подождите', 429);
		return;
	}

	const now = Date.now();
	const current = memory.get(key);
	if (!current || current.resetAt < now) {
		memory.set(key, { count: 1, resetAt: now + windowSeconds * 1000 });
		return;
	}
	current.count += 1;
	if (current.count > max) throw new DomainError('Слишком много запросов, подождите', 429);
}
