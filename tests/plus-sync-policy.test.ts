import { describe, expect, it } from 'vitest';
import {
	applyPlusProgress,
	canStartPlusSync,
	createQueuedJob,
	formatPlusSyncProgress,
	PLUS_STALE_MS,
	parsePlusProgressLine,
	shouldAutoStartPlusSync,
	shouldClaimPlusJob,
	type PlusSyncJob
} from '@/lib/plus-sync-policy';
import { canConsumePlusCdn } from '@/lib/plus-cdn-limit';

function job(overrides: Partial<PlusSyncJob>): PlusSyncJob {
	return {
		userId: 'u1',
		status: 'done',
		officialHeroCount: 4,
		error: null,
		startedAt: '2026-08-23T10:00:00.000Z',
		finishedAt: '2026-08-23T10:02:00.000Z',
		...overrides
	};
}

describe('canStartPlusSync', () => {
	it('allows first run', () => {
		expect(canStartPlusSync(null).ok).toBe(true);
	});

	it('blocks a job that is already running', () => {
		const gate = canStartPlusSync(job({ status: 'running', finishedAt: null }));
		expect(gate.ok).toBe(false);
		if (!gate.ok) expect(gate.code).toBe('busy');
	});

	it('blocks cooldown after a successful run', () => {
		const finishedAt = new Date('2026-08-23T12:00:00.000Z');
		const gate = canStartPlusSync(job({ status: 'done', finishedAt: finishedAt.toISOString() }), finishedAt.getTime() + 60_000);
		expect(gate.ok).toBe(false);
		if (!gate.ok) expect(gate.code).toBe('cooldown');
	});

	it('allows retry after cooldown or error', () => {
		const finishedAt = new Date('2026-08-23T12:00:00.000Z');
		expect(canStartPlusSync(job({ status: 'done', finishedAt: finishedAt.toISOString() }), finishedAt.getTime() + 11 * 60_000).ok).toBe(true);
		expect(canStartPlusSync(job({ status: 'error', error: 'fail', finishedAt: finishedAt.toISOString() }), finishedAt.getTime() + 1000).ok).toBe(true);
	});

	it('creates a queued job', () => {
		expect(createQueuedJob('u1').status).toBe('queued');
		expect(createQueuedJob('u1').stage).toBe('lookup');
		expect(createQueuedJob('u1', new Date(), '76561198000000000').steamId).toBe('76561198000000000');
	});
});

describe('shouldAutoStartPlusSync', () => {
	it('starts when there is no official snapshot yet', () => {
		expect(shouldAutoStartPlusSync({ job: null, capturedAt: null })).toBe(true);
	});

	it('starts when OpenDota lastPlayed is newer than the snapshot', () => {
		const capturedAt = '2026-08-23T10:00:00.000Z';
		const lastPlayed = Math.floor(Date.parse('2026-09-20T08:00:00.000Z') / 1000);
		expect(
			shouldAutoStartPlusSync({
				job: job({ status: 'done', finishedAt: '2026-08-23T10:12:00.000Z' }),
				capturedAt,
				newestLastPlayedUnix: lastPlayed,
				now: Date.parse('2026-09-20T12:00:00.000Z')
			})
		).toBe(true);
	});

	it('waits for cooldown even if a newer match exists', () => {
		const finishedAt = Date.parse('2026-09-20T12:00:00.000Z');
		expect(
			shouldAutoStartPlusSync({
				job: job({ status: 'done', finishedAt: new Date(finishedAt).toISOString() }),
				capturedAt: '2026-08-23T10:00:00.000Z',
				newestLastPlayedUnix: Math.floor(finishedAt / 1000) + 3600,
				now: finishedAt + 60_000
			})
		).toBe(false);
	});

	it('starts after 6h even without a newer lastPlayed', () => {
		const captured = Date.parse('2026-09-20T00:00:00.000Z');
		expect(
			shouldAutoStartPlusSync({
				job: job({ status: 'done', finishedAt: '2026-09-19T12:00:00.000Z' }),
				capturedAt: new Date(captured).toISOString(),
				newestLastPlayedUnix: Math.floor(captured / 1000) - 3600,
				now: captured + 6 * 60 * 60_000
			})
		).toBe(true);
	});
});

describe('shouldClaimPlusJob', () => {
	it('claims queued jobs and stale running jobs', () => {
		expect(shouldClaimPlusJob(null)).toBe(false);
		expect(shouldClaimPlusJob(job({ status: 'queued', finishedAt: null }))).toBe(true);
		expect(shouldClaimPlusJob(job({ status: 'running', finishedAt: null, startedAt: '2026-08-25T10:00:00.000Z' }), Date.parse('2026-08-25T10:01:00.000Z'))).toBe(false);
		expect(
			shouldClaimPlusJob(
				job({ status: 'running', finishedAt: null, startedAt: '2026-08-25T10:00:00.000Z' }),
				Date.parse('2026-08-25T10:00:00.000Z') + PLUS_STALE_MS
			)
		).toBe(true);
		expect(shouldClaimPlusJob(job({ status: 'done' }))).toBe(false);
		expect(shouldClaimPlusJob(job({ status: 'error', error: 'fail' }))).toBe(false);
	});
});

describe('plus sync progress', () => {
	it('parses PLUS_PROGRESS lines and ignores noise', () => {
		expect(parsePlusProgressLine('debug')).toBeNull();
		expect(parsePlusProgressLine('PLUS_PROGRESS {"stage":"download","currentHeroId":22,"replaysTried":3}')).toEqual({
			stage: 'download',
			currentHeroId: 22,
			replaysTried: 3
		});
	});

	it('formats the live button label', () => {
		const running = applyPlusProgress(createQueuedJob('u1'), {
			stage: 'download',
			currentHeroName: 'Zeus',
			replaysTried: 3,
			heroesTargeted: 8
		});
		expect(formatPlusSyncProgress(running)).toBe('Сейчас качаю Zeus — реплей 3 из 8');
		expect(
			formatPlusSyncProgress(
				applyPlusProgress(createQueuedJob('u1'), {
					stage: 'parse',
					currentHeroName: 'Zeus',
					matchId: 123,
					lastEvent: 'downloaded',
					replaysTried: 3,
					heroesTargeted: 8
				})
			)
		).toBe('Скачан матч Zeus #123 — реплей 3 из 8');
		expect(
			formatPlusSyncProgress(
				applyPlusProgress(createQueuedJob('u1'), {
					stage: 'parse',
					currentHeroName: 'Zeus',
					replaysTried: 3,
					heroesTargeted: 8,
					heroesDone: [1]
				})
			)
		).toBe('Сейчас разбираю Zeus — реплей 3 из 8 · готово героев: 1');
		expect(formatPlusSyncProgress(createQueuedJob('u1'))).toContain('очереди воркера');
		expect(formatPlusSyncProgress({ ...createQueuedJob('u1'), status: 'running', stage: 'lookup' })).toContain('Ищу матчи');
		expect(formatPlusSyncProgress({ ...createQueuedJob('u1'), status: 'running', stage: 'save' })).toContain(
			'Записываю'
		);
	});
});

describe('plus CDN limit', () => {
	it('blocks another download hour after the cap', () => {
		expect(canConsumePlusCdn(20).ok).toBe(false);
		expect(canConsumePlusCdn(19).remaining).toBe(1);
	});
});
