'use client';

import { useEffect, useMemo, useState } from 'react';
import { formatPrizeAmount } from '@/lib/prize-places';

type AdminUser = { id: string; displayName: string; balance: number; steamId?: string | null };

export default function AdminBalancePage() {
	const [users, setUsers] = useState<AdminUser[]>([]);
	const [userId, setUserId] = useState('');
	const [amount, setAmount] = useState('15000');
	const [desc, setDesc] = useState('Пополнение админом');
	const [penalty, setPenalty] = useState(false);
	const [msg, setMsg] = useState<string | null>(null);
	const [busy, setBusy] = useState(false);
	const [requests, setRequests] = useState<Array<{ id: string; title: string; body: string; linkUrl: string | null }>>([]);

	useEffect(() => {
		const preset = new URLSearchParams(window.location.search).get('userId') || '';
		void fetch('/api/admin/users', { cache: 'no-store' })
			.then((res) => res.json())
			.then((body) => {
				const list = (body.users || []) as AdminUser[];
				setUsers(list);
				setUserId(preset || list[0]?.id || '');
			});
		void fetch('/api/admin/topup-requests', { cache: 'no-store' })
			.then((res) => res.json())
			.then((body) => setRequests(body.items || []));
	}, []);

	const selected = useMemo(() => users.find((user) => user.id === userId) ?? null, [users, userId]);

	async function submit(event: React.FormEvent) {
		event.preventDefault();
		setBusy(true);
		setMsg(null);
		const rub = Number(amount);
		const response = await fetch('/api/admin/balance', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({
				userId,
				amount: Math.round(rub * 100),
				description: desc,
				penalty
			})
		});
		const body = await response.json();
		setMsg(response.ok ? `Проведено ${rub} ₽` : body.error || 'Ошибка');
		if (response.ok) {
			const refreshed = await fetch('/api/admin/users', { cache: 'no-store' }).then((res) => res.json());
			setUsers(refreshed.users || []);
		}
		setBusy(false);
	}

	return (
		<section className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
			<form onSubmit={(event) => void submit(event)} className="obsidian-glass space-y-3 rounded-card p-5">
				<h2 className="font-display text-xl text-cream">Пополнение / списание</h2>
				<p className="text-sm text-muted">Сумма в рублях. Минус списывает. 15 000 ₽ для Clash — только если кладёте сами, сайт не печатает.</p>
				<select
					value={userId}
					onChange={(event) => setUserId(event.target.value)}
					className="w-full rounded-lg border border-line bg-panel px-3 py-2 text-cream"
				>
					{users.map((user) => (
						<option key={user.id} value={user.id}>
							{user.displayName} · {formatPrizeAmount(user.balance)}
						</option>
					))}
				</select>
				<input
					value={amount}
					onChange={(event) => setAmount(event.target.value)}
					className="w-full rounded-lg border border-line bg-panel px-3 py-2 text-cream"
					placeholder="Сумма, ₽"
				/>
				<input
					value={desc}
					onChange={(event) => setDesc(event.target.value)}
					className="w-full rounded-lg border border-line bg-panel px-3 py-2 text-cream"
					placeholder="Описание проводки"
				/>
				<label className="flex items-center gap-2 text-sm text-muted">
					<input type="checkbox" checked={penalty} onChange={(event) => setPenalty(event.target.checked)} />
					Штраф (тип PENALTY, не обычное списание)
				</label>
				<button type="submit" disabled={busy || !userId} className="rounded-full bg-aegis px-4 py-2 text-sm font-semibold text-ink disabled:opacity-50">
					{busy ? 'Пишу…' : 'Провести'}
				</button>
				{msg && <p className="text-sm text-aegisSoft">{msg}</p>}
			</form>
			<article className="obsidian-glass rounded-card p-5">
				<h2 className="font-display text-xl text-cream">Выбранный кошелёк</h2>
				{selected ? (
					<div className="mt-3 space-y-1 text-sm text-muted">
						<p className="text-cream">{selected.displayName}</p>
						<p>{selected.steamId || 'Steam не привязан'}</p>
						<p className="font-mono text-aegisSoft">{formatPrizeAmount(selected.balance)}</p>
						<p className="text-xs">{selected.id}</p>
						<a href={`/admin/users/${selected.id}`} className="text-sm text-aegisSoft">
							Карточка и проводки
						</a>
					</div>
				) : (
					<p className="mt-3 text-sm text-muted">Выберите игрока.</p>
				)}
				{requests.length > 0 && (
					<div className="mt-4 space-y-2">
						<p className="text-sm text-cream">Заявки оргов</p>
						{requests.slice(0, 8).map((item) => (
							<a key={item.id} href={item.linkUrl || '/admin/balance'} className="block text-xs text-muted hover:text-cream">
								{item.title}: {item.body}
							</a>
						))}
					</div>
				)}
			</article>
		</section>
	);
}
