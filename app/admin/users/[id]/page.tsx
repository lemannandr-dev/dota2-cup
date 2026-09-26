'use client';

import { useCallback, useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { adminRoleLabel, adminTxTypeLabel } from '@/lib/admin-copy';
import { formatPrizeAmount } from '@/lib/prize-places';

type Detail = {
	id: string;
	displayName: string;
	steamId: string | null;
	role: string;
	balance: number;
	totp: boolean;
	transactions: Array<{ id: string; amount: number; type: string; description: string; createdAt: string }>;
	teams: Array<{ id: string; name: string; role: string }>;
	cups: Array<{ id: string; title: string; status: string; prizeStatus: string }>;
};

export default function AdminUserCardPage() {
	const params = useParams<{ id: string }>();
	const userId = params.id;
	const [user, setUser] = useState<Detail | null>(null);
	const [error, setError] = useState<string | null>(null);
	const [busy, setBusy] = useState(false);

	const load = useCallback(async () => {
		const response = await fetch(`/api/admin/users/${userId}`, { cache: 'no-store' });
		const body = await response.json();
		if (!response.ok) setError(body.error || 'Не загрузилось');
		else setUser(body.user);
	}, [userId]);

	useEffect(() => {
		if (userId) void load();
	}, [load, userId]);

	async function resetTotp() {
		if (!confirm('Сбросить ключ выплаты? Игрок заведёт новый в профиле. Секрет в чат не пишем.')) return;
		setBusy(true);
		const response = await fetch(`/api/admin/users/${params.id}`, {
			method: 'PATCH',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ totpReset: true })
		});
		if (!response.ok) setError((await response.json()).error || 'Не сбросилось');
		else await load();
		setBusy(false);
	}

	if (!user) return <p className="text-sm text-muted">{error || 'Загрузка…'}</p>;

	return (
		<section className="space-y-5">
			{error && <p className="text-sm text-red-200">{error}</p>}
			<article className="obsidian-glass space-y-2 rounded-card p-5">
				<h2 className="font-display text-2xl text-cream">{user.displayName}</h2>
				<p className="text-sm text-muted">
					{user.steamId || 'Steam не привязан'} · {adminRoleLabel(user.role)} · {user.totp ? 'ключ выплаты есть' : 'ключа нет'}
				</p>
				<p className="font-mono text-xl text-aegisSoft">{formatPrizeAmount(user.balance)}</p>
				<div className="flex flex-wrap gap-3">
					<a href={`/admin/balance?userId=${user.id}`} className="text-sm text-aegisSoft">
						Пополнить
					</a>
					<a href={`/profile/${user.id}`} className="text-sm text-aegisSoft">
						Профиль
					</a>
					<button type="button" disabled={busy || !user.totp} onClick={() => void resetTotp()} className="text-sm text-red-200 disabled:opacity-40">
						Сбросить ключ
					</button>
				</div>
			</article>
			<div className="grid gap-4 lg:grid-cols-2">
				<article className="obsidian-glass space-y-2 rounded-card p-5">
					<h3 className="font-display text-lg text-cream">Проводки</h3>
					{user.transactions.map((row) => (
						<div key={row.id} className="flex justify-between gap-3 border-t border-line/40 pt-2 text-sm">
							<p className="text-muted">
								{row.description} · {adminTxTypeLabel(row.type)}
							</p>
							<p className="font-mono text-cream">{formatPrizeAmount(row.amount)}</p>
						</div>
					))}
				</article>
				<article className="obsidian-glass space-y-2 rounded-card p-5">
					<h3 className="font-display text-lg text-cream">Команды и кубки</h3>
					{user.teams.map((team) => (
						<p key={`${team.id}-${team.role}`} className="text-sm text-cream">
							{team.name} · {team.role}
						</p>
					))}
					{user.cups.map((cup) => (
						<a key={cup.id} href={`/tournaments/${cup.id}`} className="block text-sm text-aegisSoft">
							{cup.title}
						</a>
					))}
				</article>
			</div>
		</section>
	);
}
