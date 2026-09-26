'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { formatPlusSyncProgress, type PlusSyncJob } from '@/lib/plus-sync-policy';

export function PlusReplaySyncButton({ autoStarted = false }: { autoStarted?: boolean }) {
	const router = useRouter();
	const [job, setJob] = useState<PlusSyncJob | null>(null);
	const [error, setError] = useState<string | null>(null);
	const [autoHint, setAutoHint] = useState(autoStarted);
	const busy = job?.status === 'queued' || job?.status === 'running';

	async function loadJob() {
		const response = await fetch('/api/dota-sync/public-replays', { cache: 'no-store' });
		if (!response.ok) return null;
		const body = (await response.json()) as { job?: PlusSyncJob | null };
		setJob(body.job ?? null);
		return body.job ?? null;
	}

	useEffect(() => {
		void loadJob().then((next) => {
			if (autoStarted && !next) setAutoHint(false);
		});
	}, [autoStarted]);

	useEffect(() => {
		if (job?.status === 'done' || job?.status === 'error') setAutoHint(false);
	}, [job?.status]);

	useEffect(() => {
		if (!busy) return;
		const timer = window.setInterval(() => {
			void loadJob().then((next) => {
				if (next?.status === 'done') router.refresh();
			});
		}, 2500);
		return () => window.clearInterval(timer);
	}, [busy, router]);

	async function startSync() {
		setError(null);
		const response = await fetch('/api/dota-sync/public-replays', { method: 'POST' });
		const body = (await response.json()) as { error?: string; job?: PlusSyncJob };
		if (body.job) setJob(body.job);
		if (!response.ok) {
			setError(body.error || 'Не удалось запустить синхронизацию');
			return;
		}
	}

	return (
		<div className="space-y-2">
			<button
				type="button"
				onClick={() => void startSync()}
				disabled={busy}
				className="rounded-lg border border-aegis/50 bg-aegis/10 px-3 py-2 text-sm text-aegisSoft hover:bg-aegis/20 disabled:opacity-60"
			>
				{busy ? 'Идёт разбор…' : 'Подтянуть уровни как в игре'}
			</button>
			{busy && job && <p className="text-sm text-cream">{formatPlusSyncProgress(job)}</p>}
			{autoHint && busy ? (
				<p className="text-xs text-muted">Снимок устарел после новых каток — разбираю публичные реплеи Valve. Пароль не нужен.</p>
			) : null}
			{busy && (
				<p className="text-xs text-muted">
					Бейдж только с официального XP из реплея. Не +50 за игру и не +16 рейтинга арены.
				</p>
			)}
			{job?.status === 'done' && (
				<p className="text-xs text-radiant">Официальный XP записан для {job.officialHeroCount ?? 0} героев</p>
			)}
			{(error || job?.error) && <p className="text-xs text-red-300">{error || job?.error}</p>}
		</div>
	);
}
