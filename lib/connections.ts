import { prisma } from './prisma';
import { createClient } from 'redis';

export { prisma };

export const redis = createClient({ url: process.env.REDIS_URL });
redis.on('error', (err) => console.error('Redis error', err));
(async () => {
	try {
		if (!redis.isOpen) await redis.connect();
	} catch {}
})();













