import { canConsumePlusCdn } from '@/lib/plus-cdn-limit';
import { addPlusCdnDownloads, readPlusCdnUsed } from '@/lib/plus-cdn-usage';
import { collectOfficialPlusFromPublicReplays } from '@/lib/official-plus-from-replays';
import { applyPlusProgress, type PlusSyncJob } from '@/lib/plus-sync-policy';
import { claimNextPlusSyncJob, finishPlusSyncJob, readPlusSyncJob, writePlusSyncJob } from '@/lib/plus-sync-job';
import { saveOfficialHeroProgress } from '@/lib/save-official-hero-progress';

async function persistJob(userId: string, job: PlusSyncJob) {
	await writePlusSyncJob(userId, job);
}

export async function runPlusSyncJob(userId: string, steamId: string) {
	const current = (await readPlusSyncJob(userId)) ?? {
		userId,
		steamId,
		status: 'running' as const,
		officialHeroCount: null,
		error: null,
		startedAt: new Date().toISOString(),
		finishedAt: null,
		stage: 'lookup' as const,
		replaysTried: 0,
		replaysParsed: 0,
		heroesDone: []
	};
	const cdn = canConsumePlusCdn(await readPlusCdnUsed(userId));
	if (!cdn.ok) {
		await persistJob(userId, {
			...current,
			status: 'error',
			error: `Лимит скачиваний Valve на этот час: ${cdn.used} из ${cdn.max}. Подождите, не долбим replay CDN.`,
			finishedAt: new Date().toISOString()
		});
		return;
	}

	let job: PlusSyncJob = {
		...current,
		steamId,
		status: 'running',
		startedAt: new Date().toISOString(),
		finishedAt: null,
		error: null,
		stage: current.stage ?? 'lookup'
	};
	let lastTried = job.replaysTried ?? 0;
	await persistJob(userId, job);
	try {
		const result = await collectOfficialPlusFromPublicReplays(steamId, 25, {
			maxDownloads: cdn.remaining,
			onProgress: async (progress) => {
				job = applyPlusProgress(job, progress);
				const tried = job.replaysTried ?? 0;
				const delta = tried - lastTried;
				lastTried = tried;
				if (delta > 0) await addPlusCdnDownloads(userId, delta);
				await persistJob(userId, job);
			}
		});
		job = applyPlusProgress(job, { stage: 'save', currentHeroName: null, currentHeroId: null });
		await persistJob(userId, job);
		const saved = await saveOfficialHeroProgress(
			userId,
			result.heroes.map((hero) => ({
				heroId: hero.heroId,
				level: hero.level,
				xp: hero.xp,
				source: hero.source ?? 'public_replay',
				matchId: hero.matchId
			})),
			{
				helperVersion: 'public-replay',
				detectedAt: new Date().toISOString(),
				steamDetected: true,
				dotaDetected: false,
				replaysScanned: result.public?.replaysTried ?? 0,
				matchesWithMetadata: result.public?.replaysParsed ?? 0,
				heroProgressPresent: result.heroProgressPresent,
				publicReplayMeta: result.public
			}
		);
		await persistJob(userId, {
			...job,
			status: 'done',
			officialHeroCount: saved.officialHeroCount,
			error: null,
			finishedAt: new Date().toISOString(),
			stage: 'save'
		});
	} catch (error) {
		await persistJob(userId, {
			...job,
			status: 'error',
			officialHeroCount: current.officialHeroCount,
			error: error instanceof Error ? error.message : 'Replay sync failed',
			finishedAt: new Date().toISOString()
		});
	}
}

export async function drainPlusSyncQueue() {
	const claimed = await claimNextPlusSyncJob();
	if (!claimed) return null;
	console.log('plus sync claimed', claimed.userId);
	try {
		await runPlusSyncJob(claimed.userId, claimed.steamId);
	} finally {
		await finishPlusSyncJob(claimed.userId);
	}
	return claimed.userId;
}

export function startPlusSyncWorker() {
	const intervalMs = Number(process.env.PLUS_SYNC_POLL_MS || 3000);
	const loop = async () => {
		try {
			await drainPlusSyncQueue();
		} catch (error) {
			console.error('plus sync worker failed', error);
		} finally {
			setTimeout(() => {
				void loop();
			}, intervalMs);
		}
	};
	void loop();
	console.log(`Plus sync worker interval ${intervalMs}ms`);
}
