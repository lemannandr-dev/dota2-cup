'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { PlusReplaySyncButton } from '@/components/heroes/PlusReplaySyncButton';
import { formatMoscowDateTime } from '@/lib/datetime';

type SyncStatus = {
	lastSyncedAt: string | null;
	officialHeroCount: number;
	steamDetected: boolean | null;
	dotaDetected: boolean | null;
	helperVersion: string | null;
	cacheFound: boolean | null;
	cacheFileName: string | null;
	plusSubscriber: boolean | null;
	challengeCount: number | null;
	heroProgressPresent: boolean | null;
	cacheOwnerMatched: boolean | null;
	pendingExpiresAt: string | null;
};

function formatWhen(value: string | null) {
	if (!value) return null;
	return formatMoscowDateTime(value);
}

function remainingLabel(expiresAt: string | null) {
	if (!expiresAt) return null;
	const ms = new Date(expiresAt).getTime() - Date.now();
	if (ms <= 0) return 'код истёк';
	const seconds = Math.ceil(ms / 1000);
	const minutes = Math.floor(seconds / 60);
	const rest = seconds % 60;
	return `${minutes}:${String(rest).padStart(2, '0')}`;
}

export function DotaSyncPanel({
	lastSyncedAt,
	officialHeroCount
}: {
	lastSyncedAt: string | null;
	officialHeroCount: number;
}) {
	const router = useRouter();
	const [status, setStatus] = useState<SyncStatus>({
		lastSyncedAt,
		officialHeroCount,
		steamDetected: null,
		dotaDetected: null,
		helperVersion: null,
		cacheFound: null,
		cacheFileName: null,
		plusSubscriber: null,
		challengeCount: null,
		heroProgressPresent: null,
		cacheOwnerMatched: null,
		pendingExpiresAt: null
	});
	const [code, setCode] = useState<string | null>(null);
	const [expiresAt, setExpiresAt] = useState<string | null>(null);
	const [waitingSince, setWaitingSince] = useState<string | null>(null);
	const [busy, setBusy] = useState(false);
	const [copied, setCopied] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [now, setNow] = useState(() => Date.now());
	const [origin, setOrigin] = useState('http://localhost:3002');
	const [publishedHelper, setPublishedHelper] = useState<string | null>(null);

	useEffect(() => {
		setOrigin(window.location.origin);
		void fetch('/helper-version.json', { cache: 'no-store' })
			.then((response) => (response.ok ? response.json() : null))
			.then((body: { version?: string } | null) => {
				if (body?.version) setPublishedHelper(body.version);
			})
			.catch(() => undefined);
	}, []);

	useEffect(() => {
		const timer = window.setInterval(() => setNow(Date.now()), 1000);
		return () => window.clearInterval(timer);
	}, []);

	const refreshStatus = useCallback(async () => {
		const response = await fetch('/api/dota-sync/status', { cache: 'no-store' });
		if (!response.ok) return null;
		const next = (await response.json()) as SyncStatus;
		setStatus(next);
		return next;
	}, []);

	useEffect(() => {
		if (!code || !waitingSince) return;
		let cancelled = false;
		const tick = async () => {
			const next = await refreshStatus();
			if (cancelled || !next?.lastSyncedAt) return;
			if (new Date(next.lastSyncedAt).getTime() >= new Date(waitingSince).getTime() - 5000) {
				setCode(null);
				setExpiresAt(null);
				setWaitingSince(null);
				router.refresh();
			}
		};
		void tick();
		const timer = window.setInterval(() => void tick(), 3000);
		return () => {
			cancelled = true;
			window.clearInterval(timer);
		};
	}, [code, refreshStatus, router, waitingSince]);

	const expired = Boolean(expiresAt && new Date(expiresAt).getTime() <= now);
	const helperCommand = useMemo(
		() =>
			`.\\DotaSyncHelper.cmd ${code ?? 'КОД'} ${origin}`,
		[code, origin]
	);

	async function requestCode() {
		setBusy(true);
		setError(null);
		setCopied(false);
		try {
			const response = await fetch('/api/dota-sync/request', { method: 'POST' });
			if (response.status === 401) {
				setError('Сначала войдите через Steam.');
				return;
			}
			if (!response.ok) {
				setError('Не удалось создать код. Попробуйте ещё раз.');
				return;
			}
			const data = (await response.json()) as { code: string; expiresAt: string };
			setCode(data.code);
			setExpiresAt(data.expiresAt);
			setWaitingSince(new Date().toISOString());
		} catch {
			setError('Сеть недоступна. Проверьте, что сайт открыт, и повторите.');
		} finally {
			setBusy(false);
		}
	}

	async function copyValue(value: string) {
		try {
			await navigator.clipboard.writeText(value);
			setCopied(true);
			window.setTimeout(() => setCopied(false), 2000);
		} catch {
			setError('Не удалось скопировать. Выделите текст вручную.');
		}
	}

	return (
		<section className="obsidian-glass rounded-card p-5">
			<div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
				<div>
					<h2 className="text-xl font-semibold">Синхронизация Dota 2</h2>
					<p className="mt-1 text-sm text-gray-300">
						Подтянуть уровни как в игре — кнопка ниже. Helper дальше только если нужны локальные реплеи .dem. Пароль Steam не нужен.
					</p>
				</div>
				<button
					type="button"
					onClick={() => void requestCode()}
					disabled={busy}
					className="rounded-lg bg-aegis px-4 py-2 text-sm font-semibold text-ink hover:bg-aegisSoft disabled:opacity-60"
				>
					{busy ? 'Создаём код…' : code && !expired ? 'Выдать новый код' : 'Получить одноразовый код'}
				</button>
			</div>

			<div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-3">
				<div className="rounded border border-gray-800 bg-black/20 p-3">
					<div className="text-xs uppercase tracking-wide text-gray-400">Последний снимок</div>
					<div className="mt-1 text-sm text-white">{formatWhen(status.lastSyncedAt) ?? 'ещё не было'}</div>
				</div>
				<div className="rounded border border-gray-800 bg-black/20 p-3">
					<div className="text-xs uppercase tracking-wide text-gray-400">Кэш клиента</div>
					<div className="mt-1 text-sm text-white">
						{status.cacheFound == null
							? 'ещё не читали'
							: status.cacheFound
								? `найден${status.plusSubscriber ? ' · Dota Plus активен' : ''}`
								: 'файл cache_*_1.soc не найден'}
					</div>
				</div>
				<div className="rounded border border-gray-800 bg-black/20 p-3">
					<div className="text-xs uppercase tracking-wide text-gray-400">Уровни героев</div>
					<div className="mt-1 text-sm text-white">
						{status.officialHeroCount > 0
							? `${status.officialHeroCount} героев из клиента`
							: status.heroProgressPresent === false
								? 'в кэше нет — оценка OpenDota'
								: 'пока оценка OpenDota'}
					</div>
				</div>
			</div>

			<div className="mt-4 rounded-lg border border-aegis/30 bg-aegis/5 p-3">
				<div className="text-sm font-semibold text-cream">Подтянуть уровни как в игре</div>
				<p className="mt-1 text-xs text-gray-400">
					Сайт ставит задачу и качает ваши открытые .dem с Valve в фоне. Пароль Steam не нужен. Если реплей уже недоступен, бейджа у этого героя не будет.
				</p>
				<div className="mt-3">
					<PlusReplaySyncButton />
				</div>
			</div>

			{error && <p className="mt-3 text-sm text-red-300">{error}</p>}

			{code && !expired && (
				<div className="mt-4 rounded border border-aegis/40 bg-black/30 p-4">
					<div className="flex flex-wrap items-center justify-between gap-2">
						<div className="text-sm text-gray-300">Код действует 5 минут, один раз. Не отправляйте его никому.</div>
						<div className="font-mono text-sm text-aegisSoft">{remainingLabel(expiresAt)}</div>
					</div>
					<div className="mt-3 flex flex-col gap-2 md:flex-row md:items-center">
						<code className="block flex-1 break-all rounded border border-gray-700 bg-black/50 px-3 py-2 font-mono text-sm text-cream">{code}</code>
						<button
							type="button"
							onClick={() => void copyValue(code)}
							className="rounded-lg border border-gray-600 px-3 py-2 text-sm text-gray-200 hover:border-aegis/50"
						>
							{copied ? 'Скопировано' : 'Копировать код'}
						</button>
					</div>
					<p className="mt-3 text-sm text-gray-300">Один файл .cmd подставляет код и сразу отправляет снимок. Пароль Steam не нужен.</p>
				</div>
			)}

			{expired && <p className="mt-3 text-sm text-yellow-200">Код истёк. Нажмите «Получить одноразовый код» ещё раз.</p>}

			<ol className="mt-4 list-decimal space-y-2 pl-5 text-sm text-gray-300">
				<li>
					<a href="/DotaSyncHelper.cmd" download className="text-aegisSoft hover:text-aegis">
						Скачайте DotaSyncHelper.cmd
					</a>
					{' '}и{' '}
					<a href="/DotaSyncHelper.ps1" download className="text-aegisSoft hover:text-aegis">
						DotaSyncHelper.ps1
					</a>
					{publishedHelper ? ` (версия ${publishedHelper})` : ''}. Оба файла в одну папку. Пароль Steam не читает.
				</li>
				<li>В папке загрузок выполните одну команду — без `yes` в консоли:</li>
			</ol>
			<div className="mt-2 flex flex-col gap-2 md:flex-row md:items-start">
				<pre className="flex-1 overflow-x-auto rounded border border-gray-700 bg-black/40 px-3 py-2 text-xs text-cream">{helperCommand}</pre>
				<button
					type="button"
					onClick={() => void copyValue(helperCommand)}
					className="rounded-lg border border-gray-600 px-3 py-2 text-sm text-gray-200 hover:border-aegis/50"
				>
					Копировать команду
				</button>
			</div>
			<p className="mt-3 text-[11px] text-gray-500">
				Сноска: для helper нужен Python 3 на ПК. Он читает кэш Plus и локальные .dem; официальный XP — из CDOTAMatchMetadata.hero_xp только вашего SteamID. Инвентарь и userdata на сайт не уходят.
			</p>
			{status.lastSyncedAt && (
				<p className="mt-2 text-xs text-gray-500">
					Последняя синхронизация: {formatWhen(status.lastSyncedAt)}
					{status.helperVersion ? ` · helper ${status.helperVersion}` : ''}. Смотреть уровни:{' '}
					<a href="/heroes" className="text-aegisSoft hover:text-aegis">
						/heroes
					</a>
				</p>
			)}
		</section>
	);
}
