'use client';

import { useCallback, useEffect, useState } from 'react';
import { adminInboxKindLabel, type AdminInboxFilter } from '@/lib/admin-inbox';

type Item = { id: string; kind: string; title: string; hint: string; href: string };
type DisputeRow = {
	id: string;
	pair: string;
	tournamentTitle: string;
	score: string;
	reason: string;
	status: string;
	ageLabel: string;
	stale: boolean;
	href: string;
};

const FILTERS: Array<{ id: AdminInboxFilter; label: string; hint: string }> = [
	{ id: 'all', label: 'Все', hint: 'Вся очередь' },
	{ id: 'matchday', label: 'День матча', hint: 'Споры, судья, просрочки' },
	{ id: 'money', label: 'Деньги', hint: 'Эскроу, выплаты, возврат' },
	{ id: 'roster', label: 'Состав', hint: 'Чек-ин и застрявшие сетки' }
];

const EMPTY_COUNTS: Record<AdminInboxFilter, number> = { all: 0, matchday: 0, money: 0, roster: 0 };

function isFilter(value: string | null): value is AdminInboxFilter {
	return FILTERS.some((row) => row.id === value);
}

function readFilter() {
	if (typeof window === 'undefined') return 'all' as const;
	const raw = new URLSearchParams(window.location.search).get('filter');
	return isFilter(raw) ? raw : 'all';
}

function kindAccent(kind: string) {
	if (kind === 'dispute' || kind === 'review' || kind === 'overdue_report') return 'border-l-[#FF8A5C]';
	if (kind === 'escrow' || kind === 'unpaid_prize' || kind === 'stuck_escrow') return 'border-l-aegis';
	return 'border-l-line';
}

function dealsWord(count: number) {
	const mod10 = count % 10;
	const mod100 = count % 100;
	if (mod10 === 1 && mod100 !== 11) return 'дело';
	if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return 'дела';
	return 'дел';
}

function disputeStatusLabel(status: string) {
	if (status === 'OPEN') return 'Открыт';
	if (status === 'IN_REVIEW') return 'На разборе';
	return status;
}

export default function AdminInboxPage() {
	const [filter, setFilter] = useState<AdminInboxFilter>('all');
	const [ready, setReady] = useState(false);
	const [items, setItems] = useState<Item[]>([]);
	const [disputes, setDisputes] = useState<DisputeRow[]>([]);
	const [counts, setCounts] = useState(EMPTY_COUNTS);
	const [error, setError] = useState<string | null>(null);
	const [loading, setLoading] = useState(true);
	const [busy, setBusy] = useState<string | null>(null);

	const load = useCallback(async (next: AdminInboxFilter) => {
		setLoading(true);
		const response = await fetch(`/api/admin/inbox?filter=${next}`, { cache: 'no-store' });
		const body = await response.json().catch(() => null);
		if (!response.ok) {
			setError(body?.error || 'Нет доступа');
			setLoading(false);
			return;
		}
		setItems(body?.items || []);
		setDisputes(body?.disputes || []);
		setCounts(body?.counts || EMPTY_COUNTS);
		setError(null);
		setLoading(false);
	}, []);

	useEffect(() => {
		setFilter(readFilter());
		setReady(true);
	}, []);

	useEffect(() => {
		if (!ready) return;
		void load(filter);
	}, [filter, ready, load]);

	function choose(next: AdminInboxFilter) {
		setFilter(next);
		const url = new URL(window.location.href);
		if (next === 'all') url.searchParams.delete('filter');
		else url.searchParams.set('filter', next);
		window.history.replaceState(null, '', `${url.pathname}${url.search}`);
	}

	async function patchDispute(id: string, status: 'IN_REVIEW' | 'REJECTED') {
		setBusy(id);
		const response = await fetch('/api/admin/disputes', {
			method: 'PATCH',
			headers: { 'Content-Type': 'application/json' },
			credentials: 'same-origin',
			body: JSON.stringify({ id, status })
		});
		const body = await response.json().catch(() => null);
		if (!response.ok) setError(body?.error || 'Не сохранилось');
		else await load(filter);
		setBusy(null);
	}

	const showDisputes = (filter === 'all' || filter === 'matchday') && disputes.length > 0;
	const queue = showDisputes ? items.filter((item) => item.kind !== 'dispute') : items;
	const active = FILTERS.find((row) => row.id === filter) ?? FILTERS[0];

	return (
		<section className="space-y-5">
			<header className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
				<div className="max-w-2xl space-y-1">
					<h2 className="font-display text-xl text-cream">Очередь судьи</h2>
					<p className="text-sm text-muted">
						{counts.all} {dealsWord(counts.all)} на стенде. {active.hint}.
					</p>
				</div>
				<div className="grid grid-cols-2 gap-2 sm:grid-cols-4" role="tablist" aria-label="Фильтр очереди">
					{FILTERS.map((row) => {
						const selected = filter === row.id;
						const count = counts[row.id] ?? 0;
						return (
							<button
								key={row.id}
								type="button"
								role="tab"
								aria-selected={selected}
								onClick={() => choose(row.id)}
								className={`min-h-16 rounded-card border px-3 py-2 text-left ${
									selected ? 'border-aegis bg-aegis/15 text-cream' : 'border-line bg-panel/40 text-muted hover:text-cream'
								}`}
							>
								<span className="block text-[10px] uppercase tracking-[0.14em]">{row.label}</span>
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

			{loading && (
				<ul className="space-y-2" aria-hidden="true">
					{[0, 1, 2].map((row) => (
						<li key={row} className="h-16 animate-pulse rounded-card border border-line bg-panel/50" />
					))}
				</ul>
			)}

			{!loading && queue.length === 0 && !showDisputes && (
				<div className="obsidian-glass rounded-card px-4 py-8 text-sm text-muted">
					Во вкладке «{active.label}» дел нет.
				</div>
			)}

			{!loading && queue.length > 0 && (
				<ul className="space-y-2">
					{queue.map((item) => (
						<li key={item.id}>
							<a
								href={item.href}
								className={`obsidian-glass flex min-h-16 flex-col justify-center rounded-card border-l-2 px-4 py-3 hover:border-aegis/50 ${kindAccent(item.kind)}`}
							>
								<div className="flex flex-wrap items-center gap-2">
									<span className="rounded border border-line px-1.5 py-0.5 text-[10px] uppercase tracking-[0.14em] text-aegisSoft">
										{adminInboxKindLabel(item.kind as Parameters<typeof adminInboxKindLabel>[0])}
									</span>
									<span className="text-sm text-cream">{item.title}</span>
								</div>
								<p className="mt-1 text-xs text-muted">{item.hint}</p>
							</a>
						</li>
					))}
				</ul>
			)}

			{!loading && showDisputes && (
				<section className="space-y-2" aria-label="Действия по спорам">
					<h3 className="text-[10px] uppercase tracking-[0.16em] text-muted">Споры, где можно решить сразу</h3>
					{disputes.map((row) => (
						<article
							key={row.id}
							className={`obsidian-glass space-y-3 rounded-card border-l-2 p-4 ${row.stale ? 'border-l-red-400' : 'border-l-[#FF8A5C]'}`}
						>
							<div className="flex flex-wrap items-start justify-between gap-3">
								<div className="min-w-0">
									<div className="flex flex-wrap items-center gap-2">
										<p className="text-cream">{row.pair}</p>
										<span className="rounded border border-line px-1.5 py-0.5 text-[10px] uppercase tracking-[0.14em] text-muted">
											{disputeStatusLabel(row.status)}
										</span>
										{row.stale && (
											<span className="rounded border border-red-400/40 px-1.5 py-0.5 text-[10px] uppercase tracking-[0.14em] text-red-200">
												больше часа
											</span>
										)}
									</div>
									<p className="mt-1 text-xs text-muted">
										{row.tournamentTitle} · счёт {row.score} · {row.reason} · {row.ageLabel}
									</p>
								</div>
								<div className="flex flex-wrap gap-2">
									<a href={row.href} className="inline-flex min-h-11 items-center rounded-lg border border-aegis/40 px-3 text-sm text-aegisSoft">
										К паре
									</a>
									{row.status === 'OPEN' && (
										<button
											type="button"
											disabled={busy === row.id}
											onClick={() => void patchDispute(row.id, 'IN_REVIEW')}
											className="inline-flex min-h-11 items-center rounded-lg border border-line px-3 text-sm text-cream disabled:opacity-50"
										>
											На разбор
										</button>
									)}
									<button
										type="button"
										disabled={busy === row.id}
										onClick={() => void patchDispute(row.id, 'REJECTED')}
										className="inline-flex min-h-11 items-center rounded-lg border border-red-400/40 px-3 text-sm text-red-200 disabled:opacity-50"
									>
										Отклонить
									</button>
								</div>
							</div>
						</article>
					))}
				</section>
			)}
		</section>
	);
}
