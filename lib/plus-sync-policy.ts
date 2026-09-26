export type PlusSyncJobStatus = 'queued' | 'running' | 'done' | 'error';
export type PlusSyncStage = 'lookup' | 'download' | 'parse' | 'save';

export type PlusSyncLastEvent = 'downloading' | 'downloaded' | 'parsed' | 'skipped';

export type PlusSyncProgress = {
	stage?: PlusSyncStage | null;
	currentHeroId?: number | null;
	currentHeroName?: string | null;
	matchId?: number | null;
	lastEvent?: PlusSyncLastEvent | null;
	replaysTried?: number;
	replaysParsed?: number;
	heroesDone?: number[];
	heroesTargeted?: number;
};

export type PlusSyncJob = PlusSyncProgress & {
	userId: string;
	steamId?: string | null;
	status: PlusSyncJobStatus;
	officialHeroCount: number | null;
	error: string | null;
	startedAt: string;
	finishedAt: string | null;
};

const COOLDOWN_MS = 10 * 60_000;
export const PLUS_STALE_MS = 15 * 60_000;
/** Auto-queue a replay parse when the catalog snapshot is older than this. */
export const PLUS_AUTO_STALE_MS = 6 * 60 * 60_000;

export function canStartPlusSync(job: PlusSyncJob | null, now = Date.now()) {
	if (!job) return { ok: true as const };
	if (job.status === 'queued' || job.status === 'running') {
		return { ok: false as const, code: 'busy' as const, job };
	}
	if (job.status === 'done' && job.finishedAt && now - new Date(job.finishedAt).getTime() < COOLDOWN_MS) {
		return { ok: false as const, code: 'cooldown' as const, job };
	}
	return { ok: true as const };
}

/** Queue a Valve replay parse when the player likely has newer Plus XP than the stored snapshot. */
export function shouldAutoStartPlusSync(input: {
	job: PlusSyncJob | null;
	capturedAt?: string | null;
	newestLastPlayedUnix?: number | null;
	now?: number;
}): boolean {
	const now = input.now ?? Date.now();
	if (!canStartPlusSync(input.job, now).ok) return false;
	if (!input.capturedAt) return true;
	const captured = Date.parse(input.capturedAt);
	if (!Number.isFinite(captured)) return true;
	const lastPlayedMs = (input.newestLastPlayedUnix ?? 0) * 1000;
	if (lastPlayedMs > captured + 60_000) return true;
	return now - captured >= PLUS_AUTO_STALE_MS;
}

export function createQueuedJob(userId: string, now = new Date(), steamId?: string | null): PlusSyncJob {
	return {
		userId,
		steamId: steamId ?? null,
		status: 'queued',
		officialHeroCount: null,
		error: null,
		startedAt: now.toISOString(),
		finishedAt: null,
		stage: 'lookup',
		currentHeroId: null,
		currentHeroName: null,
		replaysTried: 0,
		replaysParsed: 0,
		heroesDone: [],
		heroesTargeted: 0
	};
}

export function shouldClaimPlusJob(job: PlusSyncJob | null, now = Date.now()) {
	if (!job) return false;
	if (job.status === 'queued') return true;
	if (job.status === 'running') {
		const started = new Date(job.startedAt).getTime();
		if (!Number.isFinite(started)) return true;
		return now - started >= PLUS_STALE_MS;
	}
	return false;
}

export const PLUS_PROGRESS_PREFIX = 'PLUS_PROGRESS ';

export function parsePlusProgressLine(line: string): PlusSyncProgress | null {
	const trimmed = line.trim();
	if (!trimmed.startsWith(PLUS_PROGRESS_PREFIX)) return null;
	try {
		const parsed = JSON.parse(trimmed.slice(PLUS_PROGRESS_PREFIX.length)) as PlusSyncProgress;
		if (!parsed || typeof parsed !== 'object') return null;
		return parsed;
	} catch {
		return null;
	}
}

export function applyPlusProgress(job: PlusSyncJob, progress: PlusSyncProgress): PlusSyncJob {
	return {
		...job,
		...progress,
		heroesDone: progress.heroesDone ?? job.heroesDone,
		status: job.status === 'queued' ? 'running' : job.status
	};
}

export function formatPlusSyncProgress(job: PlusSyncJob) {
	if (job.status !== 'queued' && job.status !== 'running') return '';
	if (job.status === 'queued') return 'В очереди воркера — реплей качает tick, не кабинет';
	if (job.stage === 'lookup') return 'Ищу матчи с публичными реплеями…';
	if (job.stage === 'save') return 'Записываю официальный XP…';
	const name = job.currentHeroName || (job.currentHeroId ? `героя #${job.currentHeroId}` : null);
	const tried = job.replaysTried ?? 0;
	const total = job.heroesTargeted || 0;
	const done = job.heroesDone?.length ?? 0;
	const replayBit = total > 0 ? `реплей ${tried} из ${total}` : tried > 0 ? `реплей ${tried}` : 'читаю реплей';
	const doneBit = done > 0 ? ` · готово героев: ${done}` : '';
	const matchBit = job.matchId ? ` #${job.matchId}` : '';
	if (name && job.lastEvent === 'downloaded') {
		return `Скачан матч ${name}${matchBit} — ${replayBit}${doneBit}`;
	}
	if (name && job.lastEvent === 'parsed') {
		return `Разобран матч ${name}${matchBit} — ${replayBit}${doneBit}`;
	}
	if (name) {
		const action = job.stage === 'parse' ? 'Сейчас разбираю' : 'Сейчас качаю';
		return `${action} ${name}${matchBit} — ${replayBit}${doneBit}`;
	}
	return `Читаю публичные реплеи… ${replayBit}${doneBit}. Можно закрыть вкладку, разбор идёт на сервере`;
}
