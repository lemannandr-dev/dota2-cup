'use client';

import { useCallback, useEffect, useState } from 'react';
import { adminAuditLabel, adminEntityLabel, adminTxTypeLabel } from '@/lib/admin-copy';
import { formatPrizeAmount } from '@/lib/prize-places';

type Tx = {
	id: string;
	description: string;
	amount: number;
	type: string;
	createdAt: string;
	user?: { displayName: string };
};

type Audit = {
	id: string;
	action: string;
	entity: string;
	entityId: string;
	createdAt: string;
};

export default function AdminLedgerPage() {
	const [tab, setTab] = useState<'tx' | 'audit'>('tx');
	const [q, setQ] = useState('');
	const [type, setType] = useState('');
	const [user, setUser] = useState('');
	const [from, setFrom] = useState('');
	const [to, setTo] = useState('');
	const [txs, setTxs] = useState<Tx[]>([]);
	const [audits, setAudits] = useState<Audit[]>([]);
	const [error, setError] = useState<string | null>(null);

	const query = useCallback(() => {
		const params = new URLSearchParams({ kind: tab });
		if (q) params.set('q', q);
		if (type) params.set('type', type);
		if (user) params.set('user', user);
		if (from) params.set('from', from);
		if (to) params.set('to', to);
		return params;
	}, [from, q, tab, to, type, user]);

	const load = useCallback(async () => {
		const response = await fetch(`/api/admin/ledger?${query().toString()}`, { cache: 'no-store' });
		const body = await response.json();
		if (body.error) {
			setError(body.error);
			return;
		}
		setError(null);
		if (tab === 'audit') setAudits(body.items || []);
		else setTxs(body.items || []);
	}, [query, tab]);

	useEffect(() => {
		void load();
	}, [load]);

	return (
		<section className="space-y-4">
			<div className="flex flex-wrap gap-2">
				<button type="button" onClick={() => setTab('tx')} className={tab === 'tx' ? 'rounded-full bg-aegis px-3 py-1 text-sm text-ink' : 'rounded-full border border-line px-3 py-1 text-sm text-muted'}>
					Проводки
				</button>
				<button type="button" onClick={() => setTab('audit')} className={tab === 'audit' ? 'rounded-full bg-aegis px-3 py-1 text-sm text-ink' : 'rounded-full border border-line px-3 py-1 text-sm text-muted'}>
					Аудит
				</button>
			</div>
			<div className="grid gap-2 md:grid-cols-5">
				<input value={q} onChange={(event) => setQ(event.target.value)} placeholder="Поиск" className="rounded-lg border border-line bg-panel px-3 py-2 text-cream" />
				<input value={user} onChange={(event) => setUser(event.target.value)} placeholder="Игрок" className="rounded-lg border border-line bg-panel px-3 py-2 text-cream" />
				<select value={type} onChange={(event) => setType(event.target.value)} className="rounded-lg border border-line bg-panel px-3 py-2 text-cream">
					<option value="">Все типы</option>
					{['DEPOSIT', 'WITHDRAW', 'SPENT', 'EARNED', 'BONUS', 'REFUND', 'PENALTY'].map((item) => (
						<option key={item} value={item}>
							{adminTxTypeLabel(item)}
						</option>
					))}
				</select>
				<input type="date" value={from} onChange={(event) => setFrom(event.target.value)} className="rounded-lg border border-line bg-panel px-3 py-2 text-cream" />
				<input type="date" value={to} onChange={(event) => setTo(event.target.value)} className="rounded-lg border border-line bg-panel px-3 py-2 text-cream" />
			</div>
			<div className="flex flex-wrap gap-2">
				<button type="button" onClick={() => void load()} className="rounded-full bg-aegis px-4 py-2 text-sm font-semibold text-ink">
					Найти
				</button>
				{tab === 'tx' && (
					<a href={`/api/admin/ledger?${query().toString()}&format=csv`} className="rounded-full border border-aegis/40 px-4 py-2 text-sm text-aegisSoft">
						CSV
					</a>
				)}
			</div>
			{error && <p className="text-sm text-red-200">{error}</p>}
			{tab === 'tx'
				? txs.map((item) => (
						<article key={item.id} className="obsidian-glass flex items-center justify-between gap-3 rounded-card p-4">
							<div>
								<p className="text-cream">{item.user?.displayName ?? item.description}</p>
								<p className="text-xs text-muted">
									{item.description} · {adminTxTypeLabel(item.type)} · {new Date(item.createdAt).toLocaleString('ru-RU')}
								</p>
							</div>
							<p className={item.amount >= 0 ? 'font-mono text-radiant' : 'font-mono text-red-200'}>
								{item.amount >= 0 ? '+' : ''}
								{formatPrizeAmount(item.amount)}
							</p>
						</article>
					))
				: audits.map((item) => (
						<article key={item.id} className="obsidian-glass rounded-card p-4">
							<p className="text-cream">{adminAuditLabel(item.action)}</p>
							<p className="text-xs text-muted">
								{adminEntityLabel(item.entity)} · {item.entityId} · {new Date(item.createdAt).toLocaleString('ru-RU')}
							</p>
						</article>
					))}
		</section>
	);
}
