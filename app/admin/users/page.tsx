'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { SteamAvatar } from '@/components/desk/SteamAvatar';
import { adminRoleLabel } from '@/lib/admin-copy';
import {
	adminUserCounts,
	adminUserOnArena,
	filterAdminUsers,
	isAdminUserFilter,
	type AdminUserFilter,
	type AdminUserRow
} from '@/lib/admin-users-list';
import { formatPrizeAmount } from '@/lib/prize-places';
import { isStandAdmin } from '@/lib/stand-admin';

const FILTERS: Array<{ id: AdminUserFilter; label: string; hint: string }> = [
	{ id: 'all', label: 'Все', hint: 'Последние аккаунты стенда' },
	{ id: 'steam', label: 'Со Steam', hint: 'Есть привязанный Steam' },
	{ id: 'nosteam', label: 'Без Steam', hint: 'Вход без Steam' },
	{ id: 'nokey', label: 'Без ключа', hint: 'Ключ выплаты не включён' },
	{ id: 'staff', label: 'Штаб', hint: 'Организатор, судья и владелец' },
	{ id: 'balance', label: 'Кошелёк', hint: 'Баланс не ноль' }
];

const ASSIGNABLE_ROLES = ['USER', 'GAMER', 'ORGANIZER'] as const;
const EMPTY_COUNTS = { all: 0, steam: 0, nosteam: 0, nokey: 0, staff: 0, balance: 0 };

function accountsWord(count: number) {
	const mod10 = count % 10;
	const mod100 = count % 100;
	if (mod10 === 1 && mod100 !== 11) return 'аккаунт';
	if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return 'аккаунта';
	return 'аккаунтов';
}

function readDesk() {
	if (typeof window === 'undefined') return { filter: 'all' as const, q: '' };
	const params = new URLSearchParams(window.location.search);
	const raw = params.get('filter');
	return { filter: isAdminUserFilter(raw) ? raw : ('all' as const), q: params.get('q') || '' };
}

function writeDesk(filter: AdminUserFilter, q: string) {
	const url = new URL(window.location.href);
	if (filter === 'all') url.searchParams.delete('filter');
	else url.searchParams.set('filter', filter);
	if (!q) url.searchParams.delete('q');
	else url.searchParams.set('q', q);
	window.history.replaceState(null, '', `${url.pathname}${url.search}`);
}

function roleOptions(role: string) {
	if (ASSIGNABLE_ROLES.includes(role as (typeof ASSIGNABLE_ROLES)[number])) return ASSIGNABLE_ROLES;
	return [role, ...ASSIGNABLE_ROLES];
}

export default function AdminUsersPage() {
	const [q, setQ] = useState('');
	const [serverQ, setServerQ] = useState('');
	const [filter, setFilter] = useState<AdminUserFilter>('all');
	const [ready, setReady] = useState(false);
	const [items, setItems] = useState<AdminUserRow[]>([]);
	const [error, setError] = useState<string | null>(null);
	const [loading, setLoading] = useState(true);
	const [busy, setBusy] = useState<string | null>(null);
	const [draft, setDraft] = useState<{ id: string; name: string } | null>(null);

	const load = useCallback(async (query: string) => {
		const response = await fetch(`/api/admin/users?q=${encodeURIComponent(query)}`, { cache: 'no-store' });
		const body = await response.json().catch(() => null);
		if (!response.ok) {
			setError(body?.error || 'Не удалось загрузить');
			setLoading(false);
			return;
		}
		setItems(body?.users || []);
		setError(null);
		setLoading(false);
	}, []);

	useEffect(() => {
		const desk = readDesk();
		setQ(desk.q);
		setServerQ(desk.q.trim());
		setFilter(desk.filter);
		setReady(true);
	}, []);

	useEffect(() => {
		if (!ready) return;
		const handle = window.setTimeout(() => setServerQ(q.trim()), 300);
		return () => window.clearTimeout(handle);
	}, [q, ready]);

	useEffect(() => {
		if (!ready) return;
		writeDesk(filter, q.trim());
	}, [filter, q, ready]);

	useEffect(() => {
		if (!ready) return;
		void load(serverQ);
	}, [load, ready, serverQ]);

	const matched = useMemo(() => filterAdminUsers(items, 'all', q), [items, q]);
	const visible = useMemo(() => filterAdminUsers(items, filter, q), [items, filter, q]);
	const counts = useMemo(() => (items.length ? adminUserCounts(matched) : EMPTY_COUNTS), [items.length, matched]);
	const active = FILTERS.find((row) => row.id === filter) ?? FILTERS[0];

	async function patch(userId: string, payload: Record<string, unknown>) {
		setBusy(userId);
		const response = await fetch('/api/admin/users', {
			method: 'PATCH',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ userId, ...payload })
		});
		const body = await response.json().catch(() => null);
		if (!response.ok) setError(body?.error || 'Не сохранилось');
		else await load(serverQ);
		setBusy(null);
	}

	async function remove(id: string) {
		if (!confirm('Удалить аккаунт? Владельца стенда снять нельзя.')) return;
		setBusy(id);
		const response = await fetch(`/api/admin/users?id=${id}`, { method: 'DELETE' });
		const body = await response.json().catch(() => null);
		if (!response.ok) setError(body?.error || 'Не удалилось');
		else await load(serverQ);
		setBusy(null);
	}

	async function commitRename() {
		if (!draft) return;
		const next = draft.name.trim();
		const current = items.find((user) => user.id === draft.id);
		setDraft(null);
		if (!current || !next || next === current.displayName) return;
		await patch(current.id, { displayName: next });
	}

	return (
		<section className="space-y-5">
			<header className="flex flex-col gap-4">
				<div className="max-w-2xl space-y-1">
					<h2 className="font-display text-xl text-cream">Игроки</h2>
					<p className="text-sm text-muted">
						{loading && items.length === 0
							? 'Считаю аккаунты.'
							: `${visible.length} ${accountsWord(visible.length)}. ${active.hint}. Роль владельца стенда не меняется.`}
					</p>
				</div>
				<input
					value={q}
					onChange={(event) => setQ(event.target.value)}
					placeholder="Имя, Steam или номер"
					aria-label="Имя, Steam или номер"
					className="min-h-12 w-full rounded-lg border border-line bg-panel px-3 py-2 text-base text-cream outline-none focus:border-aegis"
				/>
				<div className="grid grid-cols-3 gap-2 sm:grid-cols-6" role="tablist" aria-label="Срез игроков">
					{FILTERS.map((row) => {
						const selected = filter === row.id;
						const count = counts[row.id] ?? 0;
						return (
							<button
								key={row.id}
								type="button"
								role="tab"
								aria-selected={selected}
								onClick={() => setFilter(row.id)}
								className={`min-h-16 rounded-card border px-3 py-2 text-left ${
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
				<ul className="space-y-2" aria-hidden="true">
					{[0, 1, 2, 3].map((row) => (
						<li key={row} className="h-16 animate-pulse rounded-card border border-line bg-panel/50" />
					))}
				</ul>
			)}

			{!loading && visible.length === 0 && (
				<div className="obsidian-glass rounded-card px-4 py-8 text-sm text-muted">
					{q.trim() ? 'По этому запросу никого нет.' : `Во вкладке «${active.label}» никого нет.`}
				</div>
			)}

			{visible.length > 0 && (
				<ul className="space-y-2">
					{visible.map((user) => {
						const owner = isStandAdmin(user);
						const onArena = adminUserOnArena(user.lastLoginAt);
						const editing = draft?.id === user.id;
						return (
							<li key={user.id}>
								<article className={`obsidian-glass flex flex-col gap-3 rounded-card border-l-2 px-4 py-3 lg:flex-row lg:items-center lg:justify-between ${owner ? 'border-l-aegis' : 'border-l-line'}`}>
									<div className="flex min-w-0 items-center gap-3">
										<SteamAvatar url={user.avatarUrl} name={user.displayName} className="h-10 w-10 shrink-0" />
										<div className="min-w-0">
											<div className="flex flex-wrap items-center gap-2">
												{editing ? (
													<input
														value={draft.name}
														autoFocus
														aria-label={`Имя ${user.displayName}`}
														onChange={(event) => setDraft({ id: user.id, name: event.target.value })}
														onBlur={() => void commitRename()}
														onKeyDown={(event) => {
															if (event.key === 'Enter') event.currentTarget.blur();
															if (event.key === 'Escape') setDraft(null);
														}}
														className="min-h-9 w-48 rounded-lg border border-line bg-panel px-2 text-sm text-cream"
													/>
												) : (
													<p className="truncate font-medium text-cream">{user.displayName}</p>
												)}
												{onArena && (
													<span className="inline-flex items-center gap-1 text-[10px] uppercase tracking-[0.14em] text-radiant" title="Был на арене за последние 15 минут">
														<span className="h-1.5 w-1.5 rounded-full bg-radiant" aria-hidden="true" />
														на арене
													</span>
												)}
												<span className="rounded border border-line px-1.5 py-0.5 text-[10px] uppercase tracking-[0.14em] text-aegisSoft">
													{adminRoleLabel(user.role)}
												</span>
											</div>
											<p className="mt-1 truncate text-xs text-muted">
												{user.steamId || 'Steam не привязан'} · {formatPrizeAmount(user.balance)} · {user.totpEnabledAt ? 'ключ есть' : 'без ключа'}
											</p>
										</div>
									</div>
									<div className="flex flex-wrap items-center gap-x-3 gap-y-2">
										<select
											value={user.role}
											disabled={busy === user.id || owner}
											aria-label={`Роль ${user.displayName}`}
											title={owner ? 'Роль владельца стенда не меняется' : 'Роль на стенде'}
											onChange={(event) => void patch(user.id, { role: event.target.value })}
											className="min-h-11 rounded-lg border border-line bg-panel px-2 text-sm text-cream disabled:opacity-60"
										>
											{roleOptions(user.role).map((role) => (
												<option key={role} value={role}>
													{adminRoleLabel(role)}
												</option>
											))}
										</select>
										<a href={`/admin/users/${user.id}`} className="text-sm text-aegisSoft hover:text-aegis">
											Карточка
										</a>
										<a href={`/profile/${user.id}`} className="text-sm text-aegisSoft hover:text-aegis">
											Профиль
										</a>
										<a href={`/admin/balance?userId=${user.id}`} className="text-sm text-aegisSoft hover:text-aegis">
											Баланс
										</a>
										<button
											type="button"
											disabled={busy === user.id}
											onClick={() => setDraft({ id: user.id, name: user.displayName })}
											className="text-sm text-muted hover:text-cream"
										>
											Имя
										</button>
										{!owner && (
											<button type="button" disabled={busy === user.id} onClick={() => void remove(user.id)} className="text-sm text-red-200">
												Удалить
											</button>
										)}
									</div>
								</article>
							</li>
						);
					})}
				</ul>
			)}

			{!loading && !q.trim() && items.length >= 100 && (
				<p className="text-xs text-muted">Показаны последние 100. Уточните имя или Steam, если нужного нет в списке.</p>
			)}
		</section>
	);
}
