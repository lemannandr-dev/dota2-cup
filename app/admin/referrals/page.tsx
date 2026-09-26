'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { SteamAvatar } from '@/components/desk/SteamAvatar';
import {
	adminReferralCounts,
	adminReferralPasses,
	adminReferralProgress,
	isAdminReferralFilter,
	sortAdminReferrals,
	type AdminReferralFilter,
	type AdminReferralUser
} from '@/lib/admin-referrals';
import { formatPrizeAmount } from '@/lib/prize-places';

type Milestone = {
	id: string;
	threshold: number;
	amountKopecks: number;
	label: string;
	isActive: boolean;
	paidCount: number;
};

const FILTERS: Array<{ id: AdminReferralFilter; label: string; hint: string }> = [
	{ id: 'all', label: 'Все', hint: 'Каждый аккаунт стенда' },
	{ id: 'invited', label: 'Приглашали', hint: 'По их ссылке кто-то зашёл' },
	{ id: 'joined', label: 'Пришли', hint: 'Сами зашли по чужой ссылке' },
	{ id: 'nocode', label: 'Без кода', hint: 'Своей ссылки ещё нет' },
	{ id: 'paid', label: 'С выплатой', hint: 'Ступень уже начислена' }
];

const EMPTY_COUNTS = { all: 0, invited: 0, joined: 0, nocode: 0, paid: 0, invites: 0 };

function peopleWord(count: number) {
	const mod10 = count % 10;
	const mod100 = count % 100;
	if (mod10 === 1 && mod100 !== 11) return 'игрок';
	if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return 'игрока';
	return 'игроков';
}

function invitesWord(count: number) {
	const mod10 = count % 10;
	const mod100 = count % 100;
	if (mod10 === 1 && mod100 !== 11) return 'приглашение';
	if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return 'приглашения';
	return 'приглашений';
}

function readFilter() {
	if (typeof window === 'undefined') return 'all' as const;
	const raw = new URLSearchParams(window.location.search).get('filter');
	return isAdminReferralFilter(raw) ? raw : 'all';
}

function writeFilter(filter: AdminReferralFilter, q: string) {
	const url = new URL(window.location.href);
	if (filter === 'all') url.searchParams.delete('filter');
	else url.searchParams.set('filter', filter);
	if (!q) url.searchParams.delete('q');
	else url.searchParams.set('q', q);
	window.history.replaceState(null, '', `${url.pathname}${url.search}`);
}

function joinedOn(iso: string) {
	const time = new Date(iso);
	if (Number.isNaN(time.getTime())) return '';
	return time.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' });
}

export default function AdminReferralsPage() {
	const [items, setItems] = useState<Milestone[]>([]);
	const [people, setPeople] = useState<AdminReferralUser[]>([]);
	const [form, setForm] = useState({ threshold: '100', amount: '100', label: '100 приглашённых' });
	const [error, setError] = useState<string | null>(null);
	const [loading, setLoading] = useState(true);
	const [filter, setFilter] = useState<AdminReferralFilter>('all');
	const [q, setQ] = useState('');
	const [ready, setReady] = useState(false);

	const load = useCallback(async () => {
		const response = await fetch('/api/admin/referrals', { cache: 'no-store' });
		const body = await response.json().catch(() => null);
		if (!response.ok) {
			setError(body?.error || 'Не загрузилось');
			setLoading(false);
			return;
		}
		setItems(body?.milestones || []);
		setPeople(body?.people || []);
		setError(null);
		setLoading(false);
	}, []);

	useEffect(() => {
		const params = new URLSearchParams(window.location.search);
		setFilter(readFilter());
		setQ(params.get('q') || '');
		setReady(true);
	}, []);

	useEffect(() => {
		if (!ready) return;
		writeFilter(filter, q.trim());
	}, [filter, q, ready]);

	useEffect(() => {
		void load();
	}, [load]);

	const searched = useMemo(() => people.filter((user) => adminReferralPasses(user, 'all', q)), [people, q]);
	const counts = useMemo(() => (people.length ? adminReferralCounts(searched) : EMPTY_COUNTS), [people.length, searched]);
	const visible = useMemo(
		() => sortAdminReferrals(searched.filter((user) => adminReferralPasses(user, filter, ''))),
		[filter, searched]
	);
	const active = FILTERS.find((row) => row.id === filter) ?? FILTERS[0];

	async function create(event: React.FormEvent) {
		event.preventDefault();
		setError(null);
		const response = await fetch('/api/admin/referrals', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({
				threshold: Number(form.threshold),
				amount: Math.round(Number(form.amount) * 100),
				label: form.label
			})
		});
		if (!response.ok) setError((await response.json().catch(() => null))?.error || 'Не создалось');
		else await load();
	}

	async function save(item: Milestone, draft: { threshold: string; amount: string; label: string }) {
		setError(null);
		const response = await fetch('/api/admin/referrals', {
			method: 'PUT',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({
				id: item.id,
				threshold: Number(draft.threshold),
				amount: Math.round(Number(draft.amount) * 100),
				label: draft.label
			})
		});
		if (!response.ok) setError((await response.json().catch(() => null))?.error || 'Не сохранилось');
		else await load();
	}

	async function toggle(item: Milestone) {
		setError(null);
		const response = await fetch('/api/admin/referrals', {
			method: 'PUT',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ id: item.id, isActive: !item.isActive })
		});
		if (!response.ok) setError((await response.json().catch(() => null))?.error || 'Не сохранилось');
		else await load();
	}

	return (
		<section className="space-y-5">
			<header className="flex flex-col gap-4">
				<div className="max-w-2xl space-y-1">
					<h2 className="font-display text-xl text-cream">Рефералка</h2>
					<p className="text-sm text-muted">
						{loading && people.length === 0
							? 'Считаю приглашения.'
							: `${visible.length} ${peopleWord(visible.length)}. ${counts.invites} ${invitesWord(counts.invites)}. ${active.hint}.`}
					</p>
				</div>
				<input
					value={q}
					onChange={(event) => setQ(event.target.value)}
					placeholder="Имя, код или ник принявшего"
					aria-label="Имя, код или ник принявшего"
					className="min-h-12 w-full rounded-lg border border-line bg-panel px-3 py-2 text-base text-cream outline-none focus:border-aegis"
				/>
				<div className="grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-5" role="tablist" aria-label="Срез рефералки">
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

			{loading && people.length === 0 && (
				<ul className="space-y-3" aria-hidden="true">
					{[0, 1, 2].map((row) => (
						<li key={row} className="h-28 animate-pulse rounded-card border border-line bg-panel/50" />
					))}
				</ul>
			)}

			{!loading && visible.length === 0 && (
				<div className="obsidian-glass rounded-card px-4 py-8 text-sm text-muted">
					{q.trim() ? 'По этому запросу никого нет.' : `Во вкладке «${active.label}» никого нет.`}
				</div>
			)}

			{visible.length > 0 && (
				<ul className="space-y-3">
					{visible.map((user, index) => {
						const progress = adminReferralProgress(user.accepted.length, items);
						const percent = Math.round(progress.ratio * 100);
						const hot = user.accepted.length > 0;
						return (
							<li
								key={user.id}
								className="motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-2 motion-safe:fill-mode-both motion-safe:duration-500"
								style={{ animationDelay: `${Math.min(index, 8) * 50}ms` }}
							>
								<article className={`obsidian-glass rounded-card border-l-2 p-4 ${hot ? 'border-l-aegis' : 'border-l-line'}`}>
									<div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
										<div className="flex min-w-0 flex-1 gap-3">
											<SteamAvatar url={user.avatarUrl} name={user.displayName} className="h-11 w-11 shrink-0" />
											<div className="min-w-0 flex-1">
												<div className="flex flex-wrap items-center gap-2">
													{hot && (
														<span className="relative flex h-2.5 w-2.5" aria-hidden="true">
															<span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-radiant opacity-70" />
															<span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-radiant" />
														</span>
													)}
													<a href={`/admin/users/${user.id}`} className="truncate font-display text-xl text-cream hover:text-aegisSoft">
														{user.displayName}
													</a>
													{!user.referralCode && (
														<span className="rounded-full border border-line px-2 py-0.5 text-[11px] text-muted">Кода нет</span>
													)}
												</div>
												<p className="mt-1 text-xs text-muted">
													{[user.steamId || 'Steam не привязан', user.referralCode ? `код ${user.referralCode}` : null].filter(Boolean).join(' · ')}
													{user.invitedBy && (
														<>
															{' · пришёл от '}
															<a href={`/admin/users/${user.invitedBy.id}`} className="text-aegisSoft hover:text-aegis">
																{user.invitedBy.displayName}
															</a>
														</>
													)}
												</p>
												{(user.referralCode || user.accepted.length > 0) &&
													(progress.next ? (
														<div className="mt-3 max-w-md">
															<div className="mb-1 flex items-center justify-between gap-3 text-[11px] text-muted">
																<span className="truncate">
																	До «{progress.next.label}» ещё {progress.remaining}
																</span>
																<span>{percent}%</span>
															</div>
															<div className="h-1.5 overflow-hidden rounded-full bg-black/40">
																<div
																	className="h-full rounded-full bg-gradient-to-r from-aegis to-radiant transition-[width] duration-700 ease-out motion-reduce:transition-none"
																	style={{ width: `${percent}%` }}
																/>
															</div>
														</div>
													) : (
														<p className="mt-3 text-xs text-muted">{items.some((item) => item.isActive) ? 'Все ступени уже пройдены.' : 'Активных ступеней нет.'}</p>
													))}
												<div className="mt-3">
													<p className="text-[10px] uppercase tracking-[0.14em] text-muted">Кто принял</p>
													{user.accepted.length > 0 ? (
														<ul className="mt-2 flex flex-wrap gap-2">
															{user.accepted.map((guest) => (
																<li key={guest.id}>
																	<a
																		href={`/admin/users/${guest.id}`}
																		className="inline-flex items-center gap-2 rounded-full border border-line bg-panel/50 py-1 pl-1 pr-2.5 text-xs text-cream transition-colors hover:border-aegis/50"
																	>
																		<SteamAvatar url={guest.avatarUrl} name={guest.displayName} className="h-5 w-5" />
																		<span>{guest.displayName}</span>
																		<span className="text-muted">{joinedOn(guest.createdAt)}</span>
																	</a>
																</li>
															))}
														</ul>
													) : (
														<p className="mt-1 text-xs text-muted">По ссылке ещё никто не зашёл.</p>
													)}
												</div>
												{user.paidLabels.length > 0 && (
													<p className="mt-2 text-xs text-aegisSoft">Выплачено: {user.paidLabels.join(', ')}</p>
												)}
											</div>
										</div>
										<div className="shrink-0 lg:text-right">
											<p className="font-display text-3xl leading-none text-cream">{user.accepted.length}</p>
											<p className="mt-1 text-[11px] uppercase tracking-[0.14em] text-muted">{invitesWord(user.accepted.length)}</p>
										</div>
									</div>
								</article>
							</li>
						);
					})}
				</ul>
			)}

			{!loading && people.length >= 300 && <p className="text-xs text-muted">Показаны первые 300 аккаунтов по имени.</p>}

			<section className="space-y-3">
				<div className="max-w-2xl space-y-1">
					<h2 className="font-display text-xl text-cream">Ступени</h2>
					<p className="text-sm text-muted">
						Ступень платит пригласившему один раз, когда число новых Steam-аккаунтов по его ссылке достигает порога. Уже выплаченное не снимается.
					</p>
				</div>
				<form onSubmit={(event) => void create(event)} className="obsidian-glass grid gap-3 rounded-card p-5 md:grid-cols-4">
					<input
						value={form.threshold}
						onChange={(event) => setForm({ ...form, threshold: event.target.value })}
						placeholder="Порог, человек"
						aria-label="Порог, человек"
						className="min-h-12 rounded-lg border border-line bg-panel px-3 py-2 text-cream"
					/>
					<input
						value={form.amount}
						onChange={(event) => setForm({ ...form, amount: event.target.value })}
						placeholder="Сумма, ₽"
						aria-label="Сумма, ₽"
						className="min-h-12 rounded-lg border border-line bg-panel px-3 py-2 text-cream"
					/>
					<input
						value={form.label}
						onChange={(event) => setForm({ ...form, label: event.target.value })}
						placeholder="Подпись в балансе"
						aria-label="Подпись в балансе"
						className="min-h-12 rounded-lg border border-line bg-panel px-3 py-2 text-cream"
					/>
					<button type="submit" className="min-h-12 rounded-lg bg-aegis px-4 py-2 text-sm font-semibold text-ink">
						Добавить ступень
					</button>
				</form>
				<div className="space-y-2">
					{items.map((item) => (
						<MilestoneRow key={item.id} item={item} onSave={save} onToggle={toggle} />
					))}
					{!loading && items.length === 0 && <p className="text-sm text-muted">Ступеней пока нет.</p>}
				</div>
			</section>
		</section>
	);
}

function MilestoneRow({
	item,
	onSave,
	onToggle
}: {
	item: Milestone;
	onSave: (item: Milestone, draft: { threshold: string; amount: string; label: string }) => Promise<void>;
	onToggle: (item: Milestone) => Promise<void>;
}) {
	const [draft, setDraft] = useState({
		threshold: String(item.threshold),
		amount: String(item.amountKopecks / 100),
		label: item.label
	});

	useEffect(() => {
		setDraft({ threshold: String(item.threshold), amount: String(item.amountKopecks / 100), label: item.label });
	}, [item.threshold, item.amountKopecks, item.label]);

	return (
		<article className="obsidian-glass grid gap-3 rounded-card p-4 md:grid-cols-[8rem_8rem_1fr_auto] md:items-center">
			<input
				value={draft.threshold}
				onChange={(event) => setDraft({ ...draft, threshold: event.target.value })}
				aria-label="Порог"
				className="min-h-11 rounded-lg border border-line bg-panel px-3 py-2 text-cream"
			/>
			<input
				value={draft.amount}
				onChange={(event) => setDraft({ ...draft, amount: event.target.value })}
				aria-label="Сумма в рублях"
				className="min-h-11 rounded-lg border border-line bg-panel px-3 py-2 text-cream"
			/>
			<div className="min-w-0">
				<input
					value={draft.label}
					onChange={(event) => setDraft({ ...draft, label: event.target.value })}
					aria-label="Подпись"
					className="min-h-11 w-full rounded-lg border border-line bg-panel px-3 py-2 text-cream"
				/>
				<p className="mt-1 text-xs text-muted">
					{formatPrizeAmount(item.amountKopecks)} · выплачено {item.paidCount}
					{item.isActive ? '' : ' · выключена'}
				</p>
			</div>
			<div className="flex gap-3">
				<button type="button" onClick={() => void onSave(item, draft)} className="text-sm text-cream">
					Сохранить
				</button>
				<button type="button" onClick={() => void onToggle(item)} className="text-sm text-aegisSoft">
					{item.isActive ? 'Выключить' : 'Включить'}
				</button>
			</div>
		</article>
	);
}
