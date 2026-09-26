'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { adminPrizeStatusLabel } from '@/lib/admin-copy';
import { adminCupFill, adminCupGaps, isAdminCupStatus, readableCupCopy, type AdminCupGap, type AdminCupStatus } from '@/lib/admin-cups';
import { formatPrizeAmount } from '@/lib/prize-places';
import { formatCopy, tournamentStatusCopy, tournamentStatusLabel } from '@/lib/tournament-copy';

type Cup = {
	id: string;
	title: string;
	description: string | null;
	rules: string | null;
	format: string;
	status: string;
	maxTeams: number;
	seriesRules: string;
	region: string | null;
	prizePool: number;
	prizeCurrency: string;
	prizeStatus: string;
	startAt: string;
	checkInOpensAt: string | null;
	checkInClosesAt: string | null;
	createdById: string | null;
	ownerName: string | null;
	ownerBalance: number;
	ownerTotp: boolean;
	applications: number;
	matches: number;
	applicationStatuses: string[];
};

const FILTERS: Array<{ id: '' | AdminCupStatus; label: string; hint: string }> = [
	{ id: '', label: 'Все', hint: 'Последние кубки стенда' },
	...(['DRAFT', 'REGISTRATION', 'CHECK_IN', 'LIVE', 'FINISHED', 'CANCELLED'] as const).map((status) => ({
		id: status,
		label: tournamentStatusCopy[status].label,
		hint: tournamentStatusCopy[status].hint
	}))
];

function cupsWord(count: number) {
	const mod10 = count % 10;
	const mod100 = count % 100;
	if (mod10 === 1 && mod100 !== 11) return 'кубок';
	if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return 'кубка';
	return 'кубков';
}

function readStatus() {
	if (typeof window === 'undefined') return '' as const;
	const raw = new URLSearchParams(window.location.search).get('status');
	return isAdminCupStatus(raw) ? raw : '';
}

function writeStatus(status: '' | AdminCupStatus) {
	const url = new URL(window.location.href);
	if (!status) url.searchParams.delete('status');
	else url.searchParams.set('status', status);
	window.history.replaceState(null, '', `${url.pathname}${url.search}`);
}

function startLabel(value: string) {
	const time = new Date(value);
	if (Number.isNaN(time.getTime())) return '';
	return time.toLocaleString('ru-RU', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
}

export default function AdminTournamentsPage() {
	const [items, setItems] = useState<Cup[]>([]);
	const [filter, setFilter] = useState<'' | AdminCupStatus>('');
	const [ready, setReady] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [loading, setLoading] = useState(true);
	const [busy, setBusy] = useState<string | null>(null);
	const [draft, setDraft] = useState<{ id: string; title: string } | null>(null);

	const load = useCallback(async () => {
		const response = await fetch('/api/admin/tournaments', { cache: 'no-store' });
		const body = await response.json().catch(() => null);
		if (!response.ok) {
			setError(body?.error || 'Не загрузилось');
			setLoading(false);
			return;
		}
		setItems(body?.tournaments || []);
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
		for (const status of ['DRAFT', 'REGISTRATION', 'CHECK_IN', 'LIVE', 'FINISHED', 'CANCELLED']) {
			next[status] = items.filter((cup) => cup.status === status).length;
		}
		return next;
	}, [items]);

	const visible = useMemo(() => (filter ? items.filter((cup) => cup.status === filter) : items), [filter, items]);
	const active = FILTERS.find((row) => row.id === filter) ?? FILTERS[0];

	async function patch(id: string, payload: Record<string, unknown>) {
		setBusy(id);
		const response = await fetch('/api/admin/tournaments', {
			method: 'PATCH',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ id, ...payload })
		});
		const body = await response.json().catch(() => null);
		if (!response.ok) setError(body?.error || 'Не сохранилось');
		else await load();
		setBusy(null);
	}

	async function claim(id: string) {
		if (!confirm('Повесить кубок на вас? CONFIRMED без эскроу сбросится.')) return;
		setBusy(id);
		const response = await fetch('/api/admin/claim', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ tournamentId: id })
		});
		const body = await response.json().catch(() => null);
		if (!response.ok) setError(body?.error || 'Не забралось');
		else await load();
		setBusy(null);
	}

	async function cancel(id: string) {
		if (!confirm('Отменить кубок?')) return;
		setBusy(id);
		const response = await fetch(`/api/admin/tournaments?id=${id}`, { method: 'DELETE' });
		const body = await response.json().catch(() => null);
		if (!response.ok) setError(body?.error || 'Не отменилось');
		else await load();
		setBusy(null);
	}

	async function commitTitle() {
		if (!draft) return;
		const next = draft.title.trim();
		const current = items.find((cup) => cup.id === draft.id);
		setDraft(null);
		if (!current || next.length < 2 || next === current.title) return;
		await patch(current.id, { title: next });
	}

	return (
		<section className="space-y-5">
			<header className="flex flex-col gap-4">
				<div className="max-w-2xl space-y-1">
					<h2 className="font-display text-xl text-cream">Кубки</h2>
					<p className="text-sm text-muted">
						{loading && items.length === 0
							? 'Считаю кубки.'
							: `${visible.length} ${cupsWord(visible.length)}. ${active.hint}`}
					</p>
				</div>
				<div className="grid grid-cols-2 gap-2 sm:grid-cols-4 xl:grid-cols-7" role="tablist" aria-label="Статус кубка">
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
						<li key={row} className="h-36 animate-pulse rounded-card border border-line bg-panel/50" />
					))}
				</ul>
			)}

			{!loading && visible.length === 0 && (
				<div className="obsidian-glass rounded-card px-4 py-8 text-sm text-muted">Во вкладке «{active.label}» кубков нет.</div>
			)}

			{visible.length > 0 && (
				<ul className="space-y-3">
					{visible.map((cup, index) => {
						const gaps = adminCupGaps(cup);
						const fill = adminCupFill(cup.applicationStatuses, cup.maxTeams);
						const description = readableCupCopy(cup.description);
						const rules = readableCupCopy(cup.rules);
						const region = readableCupCopy(cup.region);
						const alert = gaps.some((gap) => gap.tone === 'alert');
						const editing = draft?.id === cup.id;
						const percent = Math.round(fill.ratio * 100);
						return (
							<li
								key={cup.id}
								className="motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-2 motion-safe:fill-mode-both motion-safe:duration-500"
								style={{ animationDelay: `${Math.min(index, 8) * 70}ms` }}
							>
								<article className={`obsidian-glass rounded-card border-l-2 p-4 ${alert ? 'border-l-aegis' : 'border-l-line'}`}>
									<div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
										<div className="min-w-0 flex-1">
											<div className="flex flex-wrap items-center gap-2">
												{cup.status === 'LIVE' && (
													<span className="relative flex h-2.5 w-2.5" aria-hidden="true">
														<span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-radiant opacity-70" />
														<span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-radiant" />
													</span>
												)}
												{editing ? (
													<input
														value={draft.title}
														autoFocus
														aria-label={`Название ${cup.title}`}
														onChange={(event) => setDraft({ id: cup.id, title: event.target.value })}
														onBlur={() => void commitTitle()}
														onKeyDown={(event) => {
															if (event.key === 'Enter') event.currentTarget.blur();
															if (event.key === 'Escape') setDraft(null);
														}}
														className="min-h-9 w-full max-w-md rounded-lg border border-line bg-panel px-2 text-sm text-cream"
													/>
												) : (
													<h3 className="font-display text-xl text-cream">{cup.title}</h3>
												)}
												<span className="rounded border border-line px-1.5 py-0.5 text-[10px] uppercase tracking-[0.14em] text-aegisSoft">
													{tournamentStatusLabel(cup.status)}
												</span>
											</div>
											{description ? <p className="mt-2 line-clamp-3 text-sm leading-relaxed text-cream/90">{description}</p> : null}
											{rules ? <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-muted">{rules}</p> : null}
											<p className="mt-2 text-xs text-muted">
												{[
													formatCopy[cup.format] ?? cup.format,
													cup.seriesRules,
													region,
													startLabel(cup.startAt),
													cup.ownerName ?? 'без орга'
												]
													.filter(Boolean)
													.join(' · ')}
											</p>
											<p className="mt-1 text-xs text-muted">
												{formatPrizeAmount(cup.prizePool, cup.prizeCurrency)} · {adminPrizeStatusLabel(cup.prizeStatus)} · заявок {cup.applications} · пар {cup.matches}
											</p>
											{fill.maxTeams > 0 && (
												<div className="mt-3 max-w-md">
													<div className="mb-1 flex items-center justify-between text-[11px] text-muted">
														<span>
															В кубке {fill.seated} из {fill.maxTeams}
														</span>
														<span>{fill.pending > 0 ? `ждут решения ${fill.pending}` : `${percent}%`}</span>
													</div>
													<div className="h-1.5 overflow-hidden rounded-full bg-black/40">
														<div
															className="h-full rounded-full bg-gradient-to-r from-aegis to-radiant transition-[width] duration-700 ease-out motion-reduce:transition-none"
															style={{ width: `${percent}%` }}
														/>
													</div>
												</div>
											)}
											{gaps.length > 0 ? (
												<ul className="mt-3 flex flex-wrap gap-2" aria-label="Чего не хватает">
													{gaps.map((gap) => (
														<GapChip key={gap.id} gap={gap} />
													))}
												</ul>
											) : (
												<p className="mt-3 text-xs text-radiant">Дыр в карточке нет.</p>
											)}
										</div>
										<div className="flex flex-wrap items-center gap-2 lg:max-w-xs lg:justify-end">
											<select
												value={cup.status}
												disabled={busy === cup.id}
												aria-label={`Статус ${cup.title}`}
												onChange={(event) => void patch(cup.id, { status: event.target.value })}
												className="min-h-11 rounded-lg border border-line bg-panel px-2 text-sm text-cream disabled:opacity-60"
											>
												{FILTERS.filter((row) => row.id).map((row) => (
													<option key={row.id} value={row.id}>
														{row.label}
													</option>
												))}
											</select>
											<a href={`/tournaments/${cup.id}`} className="text-sm text-aegisSoft hover:text-aegis">
												Карточка
											</a>
											{cup.createdById && gaps.some((gap) => gap.id === 'escrow') && (
												<a href={`/admin/balance?userId=${cup.createdById}`} className="text-sm text-aegisSoft hover:text-aegis">
													Баланс
												</a>
											)}
											<button type="button" disabled={busy === cup.id} onClick={() => setDraft({ id: cup.id, title: cup.title })} className="text-sm text-muted hover:text-cream">
												Название
											</button>
											{!cup.createdById && (
												<button type="button" disabled={busy === cup.id} onClick={() => void claim(cup.id)} className="text-sm text-aegisSoft">
													Забрать сироту
												</button>
											)}
											{cup.status !== 'CANCELLED' && (
												<button type="button" disabled={busy === cup.id} onClick={() => void cancel(cup.id)} className="text-sm text-red-200">
													Отменить
												</button>
											)}
										</div>
									</div>
								</article>
							</li>
						);
					})}
				</ul>
			)}
		</section>
	);
}

function GapChip({ gap }: { gap: AdminCupGap }) {
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
