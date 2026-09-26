'use client';

import { useEffect, useState } from 'react';
import { formatPrizeAmount } from '@/lib/prize-places';

type Code = {
	id: string;
	code: string;
	amount: number;
	description: string;
	isActive: boolean;
	usedCount: number;
	maxUses: number | null;
};

export default function AdminBonusCodesPage() {
	const [items, setItems] = useState<Code[]>([]);
	const [form, setForm] = useState({ code: '', amount: '100', description: 'Бонус', maxUses: '' });
	const [error, setError] = useState<string | null>(null);

	async function load() {
		const response = await fetch('/api/admin/bonus-codes', { cache: 'no-store' });
		const body = await response.json();
		if (!response.ok) setError(body.error || 'Не загрузилось');
		else setItems(body.bonusCodes || []);
	}

	useEffect(() => {
		void load();
	}, []);

	async function create(event: React.FormEvent) {
		event.preventDefault();
		const response = await fetch('/api/admin/bonus-codes', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({
				code: form.code,
				amount: Math.round(Number(form.amount) * 100),
				description: form.description,
				maxUses: form.maxUses ? Number(form.maxUses) : null
			})
		});
		if (!response.ok) setError((await response.json()).error || 'Не создалось');
		else {
			setForm({ code: '', amount: '100', description: 'Бонус', maxUses: '' });
			await load();
		}
	}

	async function toggle(item: Code) {
		const response = await fetch('/api/admin/bonus-codes', {
			method: 'PUT',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ id: item.id, isActive: !item.isActive })
		});
		if (!response.ok) setError((await response.json()).error || 'Не сохранилось');
		else await load();
	}

	async function del(id: string) {
		const response = await fetch(`/api/admin/bonus-codes?id=${id}`, { method: 'DELETE' });
		if (!response.ok) setError((await response.json()).error || 'Не удалилось');
		else await load();
	}

	return (
		<section className="space-y-5">
			<form onSubmit={(event) => void create(event)} className="obsidian-glass grid gap-3 rounded-card p-5 md:grid-cols-4">
				<input
					value={form.code}
					onChange={(event) => setForm({ ...form, code: event.target.value.toUpperCase() })}
					placeholder="Код"
					className="rounded-lg border border-line bg-panel px-3 py-2 text-cream"
				/>
				<input
					value={form.amount}
					onChange={(event) => setForm({ ...form, amount: event.target.value })}
					placeholder="Сумма, ₽"
					className="rounded-lg border border-line bg-panel px-3 py-2 text-cream"
				/>
				<input
					value={form.description}
					onChange={(event) => setForm({ ...form, description: event.target.value })}
					placeholder="Описание"
					className="rounded-lg border border-line bg-panel px-3 py-2 text-cream"
				/>
				<input
					value={form.maxUses}
					onChange={(event) => setForm({ ...form, maxUses: event.target.value })}
					placeholder="Лимит использований"
					className="rounded-lg border border-line bg-panel px-3 py-2 text-cream"
				/>
				<button type="submit" className="rounded-full bg-aegis px-4 py-2 text-sm font-semibold text-ink md:col-span-4">
					Создать код
				</button>
			</form>
			{error && <p className="text-sm text-red-200">{error}</p>}
			<div className="space-y-2">
				{items.map((item) => (
					<article key={item.id} className="obsidian-glass flex items-center justify-between gap-3 rounded-card p-4">
						<div>
							<p className="font-mono text-cream">{item.code}</p>
							<p className="text-xs text-muted">
								{item.description} · {formatPrizeAmount(item.amount)} · {item.usedCount}/{item.maxUses ?? '∞'}
								{item.isActive ? '' : ' · выключен'}
							</p>
						</div>
						<div className="flex gap-3">
							<button type="button" onClick={() => void toggle(item)} className="text-sm text-aegisSoft">
								{item.isActive ? 'Выключить' : 'Включить'}
							</button>
							<button type="button" onClick={() => void del(item.id)} className="text-sm text-red-200">
								Снять
							</button>
						</div>
					</article>
				))}
			</div>
		</section>
	);
}
