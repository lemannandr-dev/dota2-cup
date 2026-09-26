import { acquireLock, addToSet, getCachedJson, listSet, releaseLock, removeFromSet, setCachedJson } from '@/server/cache/redis';
import { canStartPlusSync, createQueuedJob, shouldClaimPlusJob, type PlusSyncJob } from '@/lib/plus-sync-policy';

const memory = new Map<string, PlusSyncJob>();
const JOB_TTL_SECONDS = 20 * 60;
const LOCK_TTL_SECONDS = 15 * 60;
const PENDING_KEY = 'plus-sync:pending';

function jobKey(userId: string) {
	return `plus-sync:job:${userId}`;
}

function lockKey(userId: string) {
	return `plus-sync:lock:${userId}`;
}

export async function readPlusSyncJob(userId: string) {
	const cached = await getCachedJson<PlusSyncJob>(jobKey(userId));
	if (cached) return cached;
	return memory.get(userId) ?? null;
}

export async function writePlusSyncJob(userId: string, job: PlusSyncJob) {
	memory.set(userId, job);
	await setCachedJson(jobKey(userId), job, JOB_TTL_SECONDS);
}

export async function beginPlusSyncJob(userId: string, steamId: string) {
	const current = await readPlusSyncJob(userId);
	const gate = canStartPlusSync(current);
	if (!gate.ok) return gate;
	const job = createQueuedJob(userId, new Date(), steamId);
	await writePlusSyncJob(userId, job);
	const queued = await addToSet(PENDING_KEY, userId);
	if (!queued) {
		const failed: PlusSyncJob = {
			...job,
			status: 'error',
			error: 'Очередь Plus недоступна. Redis не отвечает — разбор не стартуем в кабинете.',
			finishedAt: new Date().toISOString()
		};
		await writePlusSyncJob(userId, failed);
		return { ok: false as const, code: 'queue_unavailable' as const, job: failed };
	}
	return { ok: true as const, job };
}

export async function claimNextPlusSyncJob() {
	const pending = await listSet(PENDING_KEY);
	for (const userId of pending) {
		const job = await readPlusSyncJob(userId);
		if (!job) {
			await removeFromSet(PENDING_KEY, userId);
			continue;
		}
		if (!shouldClaimPlusJob(job)) continue;
		if (!job.steamId) {
			await writePlusSyncJob(userId, {
				...job,
				status: 'error',
				error: 'Job без Steam — нажмите синк ещё раз',
				finishedAt: new Date().toISOString()
			});
			await removeFromSet(PENDING_KEY, userId);
			continue;
		}
		const locked = await acquireLock(lockKey(userId), LOCK_TTL_SECONDS);
		if (!locked) continue;
		return { userId, steamId: job.steamId, job };
	}
	return null;
}

export async function finishPlusSyncJob(userId: string) {
	await removeFromSet(PENDING_KEY, userId);
	await releaseLock(lockKey(userId));
}

export { canStartPlusSync };
export type { PlusSyncJob };
