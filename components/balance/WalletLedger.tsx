'use client';

import { useMemo, useState } from 'react';
import { formatPrizeAmount } from '@/lib/prize-places';
import { formatMoscowDateTime, formatMoscowDay } from '@/lib/datetime';
import {
	WALLET_FILTERS,
	walletFilterLabel,
	walletMatchesQuery,
	walletTxMatches,
	walletTypeLabel,
	type WalletFilter,
	type WalletTx
} from '@/lib/wallet';

function groupByDay(rows: WalletTx[]) {
	const groups: { day: string; items: WalletTx[] }[] = [];
	for (const row of rows) {
		const day = formatMoscowDay(row.createdAt);
		const last = groups[groups.length - 1];
		if (last && last.day === day) last.items.push(row);
		else groups.push({ day, items: [row] });
	}
	return groups;
}

export function WalletLedger({ items }: { items: WalletTx[] }) {
	const [filter, setFilter] = useState<WalletFilter>('ALL');
	const [query, setQuery] = useState('');
	const visible = useMemo(
		() => items.filter((row) => walletTxMatches(row, filter) && walletMatchesQuery(row, query)),
		[items, filter, query]
	);
	const groups = useMemo(() => groupByDay(visible), [visible]);

	return (
		<section id="history" className="space-y-3">
			<div className="flex flex-wrap items-end justify-between gap-3">
				<div>
					<h2 className="font-display text-xl text-cream">История</h2>
					<p className="mt-1 text-xs text-muted">
						Свои операции, последние {items.length}. Чужие кошельки здесь не видны.
					</p>
				</div>
				<label className="sr-only" htmlFor="wallet-search">
					Поиск по истории
				</label>
				<input
					id="wallet-search"
					value={query}
					onChange={(event) => setQuery(event.target.value)}
					placeholder="Кубок, промо, приз…"
					className="h-10 w-full max-w-xs rounded-full border border-line bg-panel px-4 text-sm text-cream outline-none focus:border-aegis"
				/>
			</div>
			<div className="flex flex-wrap gap-2">
				{WALLET_FILTERS.map((item) => {
					const count = items.filter((row) => walletTxMatches(row, item) && walletMatchesQuery(row, query)).length;
					return (
						<button
							key={item}
							type="button"
							onClick={() => setFilter(item)}
							className={`inline-flex min-h-9 items-center gap-1.5 rounded-full border px-3 text-xs ${
								filter === item ? 'border-aegis bg-aegis/15 text-aegisSoft' : 'border-line text-muted hover:text-cream'
							}`}
						>
							{walletFilterLabel(item)}
							<span className="font-mono text-[10px] opacity-70">{count}</span>
						</button>
					);
				})}
			</div>
			{visible.length === 0 ? (
				<div className="obsidian-glass rounded-card p-5 text-sm text-muted">
					{items.length === 0
						? 'Проводок ещё нет. Пополнение пишет орг, приз — капитану после финала, промо — строкой выше.'
						: 'По фильтру записей нет.'}
				</div>
			) : (
				<div className="space-y-4">
					{groups.map((group) => (
						<div key={group.day}>
							<p className="mb-2 font-mono text-[10px] uppercase tracking-[0.16em] text-muted">{group.day} МСК</p>
							<ul className="divide-y divide-line/50 overflow-hidden rounded-card border border-line/60">
								{group.items.map((row) => (
									<li key={row.id} className="flex flex-wrap items-baseline justify-between gap-2 bg-panel/40 px-4 py-3">
										<div className="min-w-0">
											<p className="text-sm text-cream">{row.description}</p>
											<p className="mt-0.5 text-[11px] text-muted">
												{walletTypeLabel(row.type)} · {formatMoscowDateTime(row.createdAt)} · после{' '}
												{formatPrizeAmount(row.balance)}
											</p>
										</div>
										<p className={`shrink-0 font-mono text-sm ${row.amount >= 0 ? 'text-radiant' : 'text-red-200'}`}>
											{row.amount >= 0 ? '+' : ''}
											{formatPrizeAmount(row.amount)}
										</p>
									</li>
								))}
							</ul>
						</div>
					))}
				</div>
			)}
		</section>
	);
}
