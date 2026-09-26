'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { readableCupCopy } from '@/lib/admin-cups';
import { adminMatchGaps, adminMatchRank, adminMatchSeries, isAdminMatchStatus, type AdminMatchGap, type AdminMatchStatus } from '@/lib/admin-matches';
import { bracketCopy, matchStatusCopy } from '@/lib/tournament-copy';

type Dispute = { id: string; reason: string; status: string };

type Row = {
	id: string;
	status: string;
	scoreA: number;
	scoreB: number;
	score: string;
	bestOf: number;
	round: number;
	bracket: string;
	hasTeamA: boolean;
	hasTeamB: boolean;
	teamA: string | null;
	teamB: string | null;
	hasWinner: boolean;
	dotaMatchCount: number;
	reportDeadlineAt: string | null;
	tournamentId: string;
	tournamentTitle: string;
	disputes: Dispute[];
};

const STATUSES: AdminMatchStatus[] = ['PENDING', 'SCHEDULED', 'LIVE', 'NEEDS_REVIEW', 'COMPLETED', 'TECHNICAL'];

const FILTERS: Array<{ id: '' | AdminMatchStatus; label: string; hint: string }> = [
	{ id: '', label: 'Все', hint: 'Последние пары. Счёт только читается, меняется статус.' },
	{ id: 'PENDING', label: 'Ждёт соперника', hint: 'В сетке ещё нет второй команды.' },
	{ id: 'SCHEDULED', label: 'Назначен', hint: 'Обе стороны есть, репорт ещё впереди.' },
	{ id: 'LIVE', label: 'Идёт', hint: 'Матч играется сейчас.' },
	{ id: 'NEEDS_REVIEW', label: 'На судье', hint: 'Счёт не сошёлся и ждёт решения.' },
	{ id: 'COMPLETED', label: 'Завершён', hint: 'Счёт закрыт.' },
	{ id: 'TECHNICAL', label: 'Технический', hint: 'Результат без сыгранной серии.' }
];

function pairsWord(count: number) {
	const mod10 = count % 10;
	const mod100 = count % 100;
	if (mod10 === 1 && mod100 !== 11) return 'пара';
	if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return 'пары';
	return 'пар';
}

function readStatus() {
	if (typeof window === 'undefined') return '' as const;
	const raw = new URLSearchParams(window.location.search).get('status');
	return isAdminMatchStatus(raw) ? raw : '';
}

function writeStatus(status: '' | AdminMatchStatus) {
	const url = new URL(window.location.href);
	if (!status) url.searchParams.delete('status');
	else url.searchParams.set('status', status);
	window.history.replaceState(null, '', `${url.pathname}${url.search}`);
}

function sideName(name: string | null) {
	return name?.trim() || 'ждёт соперника';
}

function toGapInput(row: Row) {
	return {
		status: row.status,
		scoreA: row.scoreA,
		scoreB: row.scoreB,
		bestOf: row.bestOf,
		hasTeamA: row.hasTeamA,
		hasTeamB: row.hasTeamB,
		hasWinner: row.hasWinner,
		dotaMatchCount: row.dotaMatchCount,
		reportDeadlineAt: row.reportDeadlineAt,
		openDisputeStatuses: row.disputes.map((dispute) => dispute.status)
	};
}

export default function AdminMatchesPage() {
	const [items, setItems] = useState<Row[]>([]);
	const [filter, setFilter] = useState<'' | AdminMatchStatus>('');
	const [ready, setReady] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [loading, setLoading] = useState(true);
	const [busy, setBusy] = useState<string | null>(null);

	const load = useCallback(async () => {
		const response = await fetch('/api/admin/matches', { cache: 'no-store' });
		const body = await response.json().catch(() => null);
		if (!response.ok) {
			setError(body?.error || 'Не загрузилось');
			setLoading(false);
			return;
		}
		setItems(body?.matches || []);
		setError(null);
		setLoading(false);
	}, []);

	useEffect(() => {
		setFilter(readStatus());
		setReady(true);
	}, []);

	useEffect(() => {
		if (!ready) return;
		writeStatus(filter);
	}, [filter, ready]);

	useEffect(() => {
		if (!ready) return;
		void load();
	}, [load, ready]);

	const counts = useMemo(() => {
		const next: Record<string, number> = { '': items.length };
		for (const status of STATUSES) next[status] = items.filter((row) => row.status === status).length;
		return next;
	}, [items]);

	const visible = useMemo(() => {
		const rows = filter ? items.filter((row) => row.status === filter) : items;
		return [...rows].sort((a, b) => {
			const alertA = adminMatchGaps(toGapInput(a)).some((gap) => gap.tone === 'alert') ? 0 : 1;
			const alertB = adminMatchGaps(toGapInput(b)).some((gap) => gap.tone === 'alert') ? 0 : 1;
			if (alertA !== alertB) return alertA - alertB;
			return adminMatchRank(a.status) - adminMatchRank(b.status);
		});
	}, [filter, items]);

	const active = FILTERS.find((row) => row.id === filter) ?? FILTERS[0];

	async function patch(id: string, status: string) {
		setBusy(id);
		const response = await fetch('/api/admin/matches', {
			method: 'PATCH',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ id, status })
		});
		const body = await response.json().catch(() => null);
		if (!response.ok) setError(body?.error || 'Не сохранилось');
		else await load();
		setBusy(null);
	}

	return (
		<section className="space-y-5">
			<header className="flex flex-col gap-4">
				<div className="max-w-2xl space-y-1">
					<h2 className="font-display text-xl text-cream">Пары</h2>
					<p className="text-sm text-muted">
						{loading && items.length === 0 ? 'Считаю пары.' : `${visible.length} ${pairsWord(visible.length)}. ${active.hint}`}
					</p>
				</div>
				<div className="grid grid-cols-2 gap-2 sm:grid-cols-4 xl:grid-cols-7" role="tablist" aria-label="Статус пары">
					{FILTERS.map((row) => {
						const selected = filter === row.id;
						const count = counts[row.id] ?? 0;
						return (
							<button
								key={row.id || 'all'}
								type="button"
								role="tab"
								aria-selected={selected}
								onClick={() => setFilter(row.id)}
								className={`min-h-16 rounded-card border px-3 py-2 text-left transition-colors ${
									selected ? 'border-aegis bg-aegis/15 text-cream' : 'border-line bg-panel/40 text-muted hover:text-cream'
								}`}
							>
								<span className="block truncate text-[10px] uppercase tracking-[0.14em]">{row.label}</span>
								<span className={`mt-1 block font-display text-2xl leading-none ${count > 0 ? 'text-cream' : 'text-muted'}`}>{count}</span>
							</button>
						);
					})}
				</div>
			</header>

			{error && (
				<p className="rounded-card border border-red-400/40 bg-red-500/10 px-4 py-3 text-sm text-red-200" role="alert">
					{error}
				</p>
			)}

			{loading && items.length === 0 && (
				<ul className="space-y-3" aria-hidden="true">
					{[0, 1, 2].map((row) => (
						<li key={row} className="h-28 animate-pulse rounded-card border border-line bg-panel/50" />
					))}
				</ul>
			)}

			{!loading && visible.length === 0 && (
				<div className="obsidian-glass rounded-card px-4 py-8 text-sm text-muted">Во вкладке «{active.label}» пар нет.</div>
			)}

			{visible.length > 0 && (
				<ul className="space-y-3">
					{visible.map((match, index) => {
						const gaps = adminMatchGaps(toGapInput(match));
						const series = adminMatchSeries(match.scoreA, match.scoreB, match.bestOf);
						const alert = gaps.some((gap) => gap.tone === 'alert');
						const note = readableCupCopy(match.disputes.find((dispute) => dispute.reason)?.reason);
						const percent = Math.round(series.ratio * 100);
						return (
							<li
								key={match.id}
								className="motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-2 motion-safe:fill-mode-both motion-safe:duration-500"
								style={{ animationDelay: `${Math.min(index, 8) * 70}ms` }}
							>
								<article className={`obsidian-glass rounded-card border-l-2 p-4 ${alert ? 'border-l-aegis' : 'border-l-line'}`}>
									<div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
										<div className="min-w-0 flex-1">
											<div className="flex flex-wrap items-center gap-2">
												{match.status === 'LIVE' && (
													<span className="relative flex h-2.5 w-2.5" aria-hidden="true">
														<span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-radiant opacity-70" />
														<span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-radiant" />
													</span>
												)}
												<h3 className="font-display text-xl text-cream">
													{sideName(match.teamA)} — {sideName(match.teamB)}
												</h3>
												<span className="rounded border border-line px-1.5 py-0.5 text-[10px] uppercase tracking-[0.14em] text-aegisSoft">
													{matchStatusCopy[match.status] ?? match.status}
												</span>
											</div>
											{note ? <p className="mt-2 line-clamp-3 text-sm leading-relaxed text-cream/90">{note}</p> : null}
											<p className="mt-2 text-xs text-muted">
												{[
													match.tournamentTitle,
													bracketCopy[match.bracket] ?? match.bracket,
													`раунд ${match.round}`,
													`BO${match.bestOf}`,
													`счёт ${match.score}`
												].join(' · ')}
											</p>
											<div className="mt-3 max-w-md">
												<div className="mb-1 flex items-center justify-between text-[11px] text-muted">
													<span>
														Карты {series.played} из {series.cap}
													</span>
													<span>{series.decided ? 'серия сыграна' : `${percent}%`}</span>
												</div>
												<div className="h-1.5 overflow-hidden rounded-full bg-black/40">
													<div
														className="h-full rounded-full bg-gradient-to-r from-aegis to-radiant transition-[width] duration-700 ease-out motion-reduce:transition-none"
														style={{ width: `${percent}%` }}
													/>
												</div>
											</div>
											{gaps.length > 0 ? (
												<ul className="mt-3 flex flex-wrap gap-2" aria-label="Чего не хватает">
													{gaps.map((gap) => (
														<GapChip key={gap.id} gap={gap} />
													))}
												</ul>
											) : (
												<p className="mt-3 text-xs text-radiant">Дыр в паре нет.</p>
											)}
										</div>
										<div className="flex flex-wrap items-center gap-2 lg:justify-end">
											<select
												value={match.status}
												disabled={busy === match.id}
												aria-label={`Статус ${sideName(match.teamA)} — ${sideName(match.teamB)}`}
												onChange={(event) => void patch(match.id, event.target.value)}
												className="min-h-11 rounded-lg border border-line bg-panel px-2 text-sm text-cream disabled:opacity-60"
											>
												{STATUSES.map((status) => (
													<option key={status} value={status}>
														{matchStatusCopy[status] ?? status}
													</option>
												))}
											</select>
											<a href={`/tournaments/${match.tournamentId}#match-${match.id}`} className="text-sm text-aegisSoft hover:text-aegis">
												К паре
											</a>
										</div>
									</div>
								</article>
							</li>
						);
					})}
				</ul>
			)}

			{!loading && items.length >= 80 && <p className="text-xs text-muted">Показаны последние 80 пар.</p>}
		</section>
	);
}

function GapChip({ gap }: { gap: AdminMatchGap }) {
	const alert = gap.tone === 'alert';
	return (
		<li
			title={gap.hint}
			className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] motion-safe:animate-in motion-safe:fade-in motion-safe:zoom-in-95 motion-safe:duration-300 ${
				alert ? 'border-aegis/50 bg-aegis/10 text-aegisSoft' : 'border-line bg-panel/50 text-muted'
			}`}
		>
			{alert && <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-aegis" aria-hidden="true" />}
			{gap.label}
		</li>
	);
}
