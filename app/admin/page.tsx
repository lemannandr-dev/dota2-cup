'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { ChevronRight, ShieldAlert } from 'lucide-react';
import { adminAuditLabel, adminEntityLabel, adminPrizeStatusLabel, adminTxTypeLabel } from '@/lib/admin-copy';
import { adminInboxKindLabel } from '@/lib/admin-inbox';
import { formatPrizeAmount } from '@/lib/prize-places';
import { tournamentStatusLabel } from '@/lib/tournament-copy';
import { BottomSheet } from '@/components/ui/BottomSheet';
import { useToast } from '@/components/ui/ToastProvider';

type Wallet = { id: string; displayName: string; balance: number; totp: boolean };
type CupRow = {
	id: string;
	title: string;
	status: string;
	prizePool: number;
	prizeStatus: string;
	applications: number;
	matches: number;
	ownerId: string | null;
	ownerName: string;
	wallet: { haveLabel: string; neededLabel: string; shortfall: number; shortfallLabel: string; canAfford: boolean };
};
type Attention = { id: string; kind: string; title: string; hint: string; href: string };
type Overview = {
	users: number;
	steamUsers: number;
	cups: number;
	liveCups: number;
	unconfirmed: number;
	teams: number;
	transactions: number;
	audits: number;
	openDisputes: number;
	reviewCount: number;
	wallet: Wallet | null;
	reconcile?: { ok: boolean; mismatchCount: number; globalDelta: number };
	attention: Attention[];
	cupRows: CupRow[];
	disputeRows: Array<{ id: string; matchId: string; tournamentId: string; tournamentTitle: string; pair: string; reason: string }>;
	reviewRows: Array<{ id: string; tournamentId: string; tournamentTitle: string; pair: string; score: string }>;
	recentTransactions: Array<{ id: string; amount: number; type: string; description: string; createdAt: string; who: string }>;
	recentAudits: Array<{ id: string; action: string; entity: string; createdAt: string }>;
};

const cards: Array<{
	key: 'users' | 'steamUsers' | 'liveCups' | 'unconfirmed' | 'openDisputes' | 'reviewCount' | 'teams' | 'transactions';
	label: string;
	hint: string;
	href: string;
	alert?: boolean;
}> = [
	{ key: 'users', label: 'Аккаунты', hint: 'Все игроки на стенде', href: '/admin/users' },
	{ key: 'steamUsers', label: 'Со Steam', hint: 'Есть привязанный Steam', href: '/admin/users?filter=steam' },
	{ key: 'liveCups', label: 'Идут', hint: 'Кубки в сетке', href: '/admin/tournaments?status=LIVE' },
	{ key: 'unconfirmed', label: 'Без эскроу', hint: 'Фонд объявлен, денег нет', href: '/admin/inbox?filter=money', alert: true },
	{ key: 'openDisputes', label: 'Споры', hint: 'Открыты или на разборе', href: '/admin/inbox?filter=matchday', alert: true },
	{ key: 'reviewCount', label: 'На судье', hint: 'Пары ждут решения', href: '/admin/inbox?filter=matchday', alert: true },
	{ key: 'teams', label: 'Команды', hint: 'Не скрытые', href: '/admin/teams' },
	{ key: 'transactions', label: 'Проводки', hint: 'Кошелёк арены', href: '/admin/ledger' }
];

function kindAccent(kind: string) {
	if (kind === 'dispute' || kind === 'review' || kind === 'overdue_report') return 'border-l-[#FF8A5C]';
	if (kind === 'escrow' || kind === 'unpaid_prize' || kind === 'stuck_escrow') return 'border-l-aegis';
	return 'border-l-line';
}

const cupStatuses = ['DRAFT', 'REGISTRATION', 'CHECK_IN', 'LIVE', 'FINISHED', 'CANCELLED'];

export default function AdminHomePage() {
	const { showToast } = useToast();
	const [data, setData] = useState<Overview | null>(null);
	const [error, setError] = useState<string | null>(null);
	const [busy, setBusy] = useState<string | null>(null);
	const [amount, setAmount] = useState('');
	const [selectedCupId, setSelectedCupId] = useState<string | null>(null);
	const [statusDraft, setStatusDraft] = useState('');
	const [loading, setLoading] = useState(true);

	const load = useCallback(async () => {
		const response = await fetch('/api/admin/overview', { cache: 'no-store' });
		if (!response.ok) {
			setError('Нет доступа');
			setLoading(false);
			return;
		}
		const body = (await response.json()) as Overview;
		setData(body);
		setError(null);
		const firstGap = body.cupRows.find((cup) => cup.prizeStatus === 'UNCONFIRMED' && cup.wallet.shortfall > 0);
		if (firstGap) setAmount((current) => current || String(firstGap.wallet.shortfall / 100));
		setLoading(false);
	}, []);

	useEffect(() => {
		void load();
	}, [load]);

	const gap = useMemo(
		() => data?.cupRows.find((cup) => cup.prizeStatus === 'UNCONFIRMED' && cup.prizePool > 0) ?? null,
		[data]
	);
	const selectedCup = useMemo(
		() => data?.cupRows.find((cup) => cup.id === selectedCupId) ?? null,
		[data, selectedCupId]
	);

	async function topUp() {
		if (!data?.wallet) return;
		const rub = Number(amount);
		if (!Number.isFinite(rub) || rub === 0) {
			setError('Укажите сумму в рублях');
			return;
		}
		setBusy('topup');
		const response = await fetch('/api/admin/balance', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({
				userId: gap?.ownerId || data.wallet.id,
				amount: Math.round(rub * 100),
				description: gap ? `Пополнение под эскроу «${gap.title}»` : 'Пополнение с панели'
			})
		});
		const body = await response.json();
		if (!response.ok) setError(body.error || 'Не провели');
		else {
			setError(null);
			await load();
		}
		setBusy(null);
	}

	async function patchCup(id: string, payload: Record<string, unknown>) {
		setBusy(id);
		try {
			const response = await fetch('/api/admin/tournaments', {
				method: 'PATCH',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ id, ...payload })
			});
			const body = await response.json();
			if (!response.ok) {
				setError(body.error || 'Не сохранилось');
				return false;
			}
			setError(null);
			await load();
			showToast('Изменения кубка сохранены');
			return true;
		} catch {
			setError('Нет связи с сервером');
			return false;
		} finally {
			setBusy(null);
		}
	}

	function openCup(cup: CupRow) {
		setSelectedCupId(cup.id);
		setStatusDraft(cup.status);
	}

	return (
		<div className="space-y-6">
			{error && <p className="text-sm text-red-200">{error}</p>}
			<section className="grid gap-4 xl:grid-cols-[1.35fr_0.85fr]">
				<article className="obsidian-glass space-y-3 rounded-card p-5">
					<div className="flex items-center justify-between gap-3">
						<h2 className="font-display text-xl text-cream">Очередь дел</h2>
						<a href="/admin/inbox" className="text-sm text-aegisSoft">
							Вся очередь
						</a>
					</div>
					{loading && (
						<ul className="space-y-2" aria-hidden="true">
							{[0, 1, 2].map((row) => (
								<li key={row} className="h-14 animate-pulse rounded-lg border border-line bg-panel/50" />
							))}
						</ul>
					)}
					{data?.reconcile && !data.reconcile.ok && (
						<p className="rounded-lg border border-red-400/40 bg-red-950/20 px-3 py-2 text-sm text-red-200">
							Баланс не сходится: {data.reconcile.mismatchCount === 1 ? '1 аккаунт' : `${data.reconcile.mismatchCount} аккаунтов`}, дельта {formatPrizeAmount(data.reconcile.globalDelta)}.
						</p>
					)}
					{!loading && data && data.attention.length === 0 && <p className="text-sm text-muted">Срочных дел нет.</p>}
					<ul className="space-y-2">
						{(data?.attention ?? []).slice(0, 6).map((item) => (
							<li key={item.id}>
								<a href={item.href} className={`flex min-h-14 flex-col justify-center rounded-lg border border-line/70 border-l-2 px-3 py-2 hover:border-aegis/50 ${kindAccent(item.kind)}`}>
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
					{data && data.attention.length > 6 && (
						<a href="/admin/inbox" className="inline-flex text-sm text-aegisSoft">
							Ещё {data.attention.length - 6} в очереди
						</a>
					)}
				</article>

				<article className="obsidian-glass space-y-3 rounded-card p-5">
					<h2 className="font-display text-xl text-cream">Кошелёк орга</h2>
					{data?.wallet ? (
						<>
							<p className="text-sm text-cream">{data.wallet.displayName}</p>
							<p className="font-mono text-2xl text-aegisSoft">{formatPrizeAmount(data.wallet.balance)}</p>
							<p className="text-xs text-muted">{data.wallet.totp ? 'Ключ выплаты включён' : 'Ключ выплаты выключен — резерв живого приза не пройдёт'}</p>
							{gap && (
								<p className="text-sm text-muted">
									«{gap.title}»: нужно {gap.wallet.neededLabel}
									{gap.wallet.shortfall > 0 ? `, не хватает ${gap.wallet.shortfallLabel}` : ', можно резервировать на карточке кубка'}
								</p>
							)}
							<div className="grid gap-2 sm:flex sm:flex-wrap">
								<input
									value={amount}
									onChange={(event) => setAmount(event.target.value)}
									placeholder="Сумма, ₽"
									className="min-h-12 w-full rounded-lg border border-line bg-panel px-3 py-2 text-base text-cream sm:w-32"
								/>
								<button
									type="button"
									disabled={busy === 'topup'}
									onClick={() => void topUp()}
									className="aegis-action min-h-12 rounded-lg bg-aegis px-4 py-2 text-sm font-semibold text-ink disabled:opacity-50"
								>
									{busy === 'topup' ? 'Пишу…' : 'Пополнить'}
								</button>
								{gap && (
									<a href={`/tournaments/${gap.id}`} className="inline-flex min-h-12 items-center justify-center rounded-lg border border-aegis/40 px-4 py-2 text-sm text-aegisSoft">
										К резерву кубка
									</a>
								)}
							</div>
						</>
					) : loading ? (
						<div className="h-24 animate-pulse rounded-lg border border-line bg-panel/50" aria-hidden="true" />
					) : (
						<p className="text-sm text-muted">Кошелёк орга не найден.</p>
					)}
				</article>
			</section>

			<section className="grid grid-cols-2 gap-3 lg:grid-cols-4 xl:grid-cols-8">
				{cards.map((card) => {
					const value = data ? data[card.key] : null;
					const hot = Boolean(card.alert && value);
					return (
						<a key={card.key} href={card.href} className={`obsidian-glass min-w-0 rounded-card p-3 hover:border-aegis/50 sm:p-4 ${hot ? 'border-aegis/50' : ''}`}>
							<p className="truncate text-[11px] uppercase tracking-[0.14em] text-muted">{card.label}</p>
							<p className={`mt-1 font-display text-2xl ${hot ? 'text-aegisSoft' : 'text-cream'}`}>{value ?? '—'}</p>
							<p className="mt-1 hidden text-[11px] text-muted sm:block">{card.hint}</p>
						</a>
					);
				})}
			</section>

			<section className="obsidian-glass space-y-3 rounded-card p-5">
				<div className="flex items-center justify-between">
					<h2 className="font-display text-xl text-cream">Кубки</h2>
					<a href="/admin/tournaments" className="text-sm text-aegisSoft">
						Все кубки
					</a>
				</div>
				<div className="space-y-2 md:hidden">
					{loading ? <p className="text-sm text-muted">Загружаю кубки…</p> : null}
					{data?.cupRows.length === 0 ? <p className="text-sm text-muted">Кубков пока нет.</p> : null}
					{data?.cupRows.map((cup) => (
						<article key={cup.id} className="rounded-lg border border-line/70 bg-black/20 p-3">
							<div className="flex items-start justify-between gap-3">
								<div className="min-w-0">
									<p className="truncate font-medium text-cream">{cup.title}</p>
									<p className="truncate text-xs text-muted">{cup.ownerName} · {tournamentStatusLabel(cup.status)}</p>
								</div>
								<p className="shrink-0 font-mono text-sm text-aegisSoft">{formatPrizeAmount(cup.prizePool)}</p>
							</div>
							<div className="mt-3 grid grid-cols-3 gap-2 text-xs">
								<div><span className="block text-muted">Эскроу</span><span className="text-cream">{adminPrizeStatusLabel(cup.prizeStatus)}</span></div>
								<div><span className="block text-muted">Заявки</span><span className="text-cream">{cup.applications}</span></div>
								<div><span className="block text-muted">Пары</span><span className="text-cream">{cup.matches}</span></div>
							</div>
							<button type="button" onClick={() => openCup(cup)} className="mt-3 flex min-h-11 w-full items-center justify-between rounded-lg border border-aegis/40 px-3 text-sm font-semibold text-aegisSoft">
								Управление кубком
								<ChevronRight className="h-4 w-4" aria-hidden="true" />
							</button>
						</article>
					))}
				</div>
				<div className="hidden overflow-x-auto md:block">
					<table className="w-full min-w-[980px] text-left text-sm">
						<thead className="text-xs uppercase tracking-wide text-muted">
							<tr>
								<th className="pb-2 pr-3">Кубок</th>
								<th className="pb-2 pr-3">Статус</th>
								<th className="pb-2 pr-3">Фонд</th>
								<th className="pb-2 pr-3">Эскроу</th>
								<th className="pb-2 pr-3">Состав</th>
								<th className="pb-2">Действия</th>
							</tr>
						</thead>
						<tbody>
							{data?.cupRows.map((cup) => (
								<tr key={cup.id} className="border-t border-line/50">
									<td className="py-3 pr-3">
										<p className="text-cream">{cup.title}</p>
										<p className="text-[11px] text-muted">{cup.ownerName}</p>
									</td>
									<td className="py-3 pr-3">
										<select
											value={cup.status}
											disabled={busy === cup.id}
											onChange={(event) => void patchCup(cup.id, { status: event.target.value })}
											className="rounded-lg border border-line bg-panel px-2 py-1 text-cream"
										>
											{cupStatuses.map((status) => (
												<option key={status} value={status}>
													{tournamentStatusLabel(status)}
												</option>
											))}
										</select>
									</td>
									<td className="py-3 pr-3 text-aegisSoft">{formatPrizeAmount(cup.prizePool)}</td>
									<td className="py-3 pr-3">
										{adminPrizeStatusLabel(cup.prizeStatus)}
										{cup.wallet.shortfall > 0 ? ` · −${cup.wallet.shortfallLabel}` : ''}
									</td>
									<td className="py-3 pr-3 text-muted">
										заявок {cup.applications} · пар {cup.matches}
									</td>
									<td className="py-3">
										<div className="flex flex-wrap gap-2">
											<a href={`/tournaments/${cup.id}`} className="text-aegisSoft">
												Карточка
											</a>
											{cup.ownerId && (
												<a href={`/admin/balance?userId=${cup.ownerId}`} className="text-aegisSoft">
													Кошелёк
												</a>
											)}
										</div>
									</td>
								</tr>
							))}
						</tbody>
					</table>
				</div>
				<BottomSheet
					open={Boolean(selectedCup)}
					onClose={() => {
						if (!busy) setSelectedCupId(null);
					}}
					title={selectedCup?.title ?? 'Кубок'}
					description={selectedCup ? `${selectedCup.ownerName} · ${selectedCup.applications} заявок · ${selectedCup.matches} пар` : undefined}
					footer={selectedCup ? (
						<button
							type="button"
							disabled={busy === selectedCup.id || statusDraft === selectedCup.status}
							onClick={async () => {
								if (await patchCup(selectedCup.id, { status: statusDraft })) setSelectedCupId(null);
							}}
							className="aegis-action min-h-12 w-full rounded-lg bg-aegis px-4 text-sm font-semibold text-ink disabled:opacity-50"
						>
							{busy === selectedCup.id ? 'Сохраняю…' : 'Сохранить статус'}
						</button>
					) : null}
				>
					{selectedCup ? (
						<div className="space-y-4">
							<label className="block text-sm text-muted">
								Статус
								<select value={statusDraft} disabled={busy === selectedCup.id} onChange={(event) => setStatusDraft(event.target.value)} className="mt-2 min-h-12 w-full rounded-lg border border-line bg-ink px-3 text-base text-cream">
									{cupStatuses.map((status) => <option key={status} value={status}>{tournamentStatusLabel(status)}</option>)}
								</select>
							</label>
							{statusDraft === 'CANCELLED' ? (
								<p className="flex gap-2 rounded-lg border border-red-400/40 bg-red-950/20 p-3 text-sm text-red-100">
									<ShieldAlert className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
									Отмена закроет турнир для игроков. Проверьте заявки и финансовые обязательства до сохранения.
								</p>
							) : null}
							<div className="grid grid-cols-2 gap-3 rounded-lg border border-line/60 bg-black/20 p-3 text-sm">
								<div><span className="block text-xs text-muted">Призовой фонд</span>{formatPrizeAmount(selectedCup.prizePool)}</div>
								<div><span className="block text-xs text-muted">Эскроу</span>{adminPrizeStatusLabel(selectedCup.prizeStatus)}</div>
							</div>
							<div className="grid grid-cols-2 gap-2">
								<a href={`/tournaments/${selectedCup.id}`} className="inline-flex min-h-12 items-center justify-center rounded-lg border border-aegis/40 px-3 text-sm text-aegisSoft">Карточка</a>
								{selectedCup.ownerId ? <a href={`/admin/balance?userId=${selectedCup.ownerId}`} className="inline-flex min-h-12 items-center justify-center rounded-lg border border-line px-3 text-sm text-cream">Кошелёк</a> : <span />}
							</div>
						</div>
					) : null}
				</BottomSheet>
			</section>

			<section className="grid gap-4 lg:grid-cols-2">
				<article className="obsidian-glass space-y-2 rounded-card p-5">
					<div className="flex items-center justify-between">
						<h2 className="font-display text-xl text-cream">Последние проводки</h2>
						<a href="/admin/ledger" className="text-sm text-aegisSoft">
							Журнал
						</a>
					</div>
					{(data?.recentTransactions ?? []).length === 0 && !loading && <p className="text-sm text-muted">Проводок пока нет.</p>}
					{(data?.recentTransactions ?? []).map((row) => (
						<div key={row.id} className="flex items-center justify-between gap-3 border-t border-line/40 pt-2 text-sm">
							<div>
								<p className="text-cream">{row.who}</p>
								<p className="text-xs text-muted">
									{row.description} · {adminTxTypeLabel(row.type)}
								</p>
							</div>
							<p className={row.amount >= 0 ? 'font-mono text-radiant' : 'font-mono text-red-200'}>
								{row.amount >= 0 ? '+' : ''}
								{formatPrizeAmount(row.amount)}
							</p>
						</div>
					))}
				</article>
				<article className="obsidian-glass space-y-2 rounded-card p-5">
					<h2 className="font-display text-xl text-cream">Аудит</h2>
					{(data?.recentAudits ?? []).length === 0 && !loading && <p className="text-sm text-muted">Записей пока нет.</p>}
					{(data?.recentAudits ?? []).map((row) => (
						<div key={row.id} className="border-t border-line/40 pt-2 text-sm">
							<p className="text-cream">{adminAuditLabel(row.action)}</p>
							<p className="text-xs text-muted">
								{adminEntityLabel(row.entity)} · {new Date(row.createdAt).toLocaleString('ru-RU')}
							</p>
						</div>
					))}
				</article>
			</section>
		</div>
	);
}
