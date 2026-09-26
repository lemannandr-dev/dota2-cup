'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import type { PayoutPreview } from '@/lib/prize-places';
import { cupDryRunLines, prizeRequiresTotp } from '@/lib/payout-totp';

const statusLabel: Record<string, string> = {
	PENDING: 'не зарезервировано',
	RESERVED: 'на эскроу',
	PAID: 'выплачено',
	VOID: 'отменено'
};

export function PayoutConfirmPanel({
	tournamentId,
	preview,
	prizePool = 0
}: {
	tournamentId: string;
	preview: PayoutPreview;
	prizePool?: number;
}) {
	const router = useRouter();
	const [open, setOpen] = useState(false);
	const [busy, setBusy] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [done, setDone] = useState<string | null>(null);
	const [totp, setTotp] = useState('');
	const [totpEnabled, setTotpEnabled] = useState(false);

	React.useEffect(() => {
		void fetch('/api/account/totp', { cache: 'no-store' })
			.then((res) => (res.ok ? res.json() : null))
			.then((data) => {
				if (data?.enabled) setTotpEnabled(true);
			})
			.catch(() => undefined);
	}, []);

	async function send(body: { reserve?: boolean; confirm?: boolean; totp?: string }) {
		setBusy(true);
		setError(null);
		setDone(null);
		const idem =
			typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
				? crypto.randomUUID()
				: `payout-${Date.now()}`;
		const response = await fetch(`/api/tournaments/${tournamentId}/payouts`, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json', 'Idempotency-Key': idem },
			credentials: 'same-origin',
			body: JSON.stringify(body)
		});
		const data = await response.json().catch(() => null);
		if (!response.ok) setError(data?.error || 'Не удалось выполнить операцию');
		else {
			setOpen(false);
			setDone(
				body.reserve
					? data?.reserved
						? 'Фонд зарезервирован на эскроу.'
						: 'Фонд всё ещё не подтверждён — проверьте баланс орга.'
					: `Выплачено строк: ${data?.paid ?? 0}.`
			);
			router.refresh();
		}
		setBusy(false);
	}

	if (preview.reason === 'no_prize' && preview.lines.length === 0) return null;
	const livePrize = prizeRequiresTotp(prizePool);
	const dryRun = cupDryRunLines(prizePool);

	return (
		<section className="obsidian-glass rounded-card space-y-3 p-5" data-payout-desk="true">
			<div className="md:hidden rounded-lg border border-line/70 bg-black/20 px-3 py-2 text-xs text-muted">
				Действия эскроу и выплаты. Сводка сверху — в полоске «Эскроу и выплата».
			</div>
			<div>
				<h3 className="font-display text-xl text-cream">Призовой фонд</h3>
				<p className="mt-1 text-sm text-muted">{preview.hint}</p>
				{preview.canReserve && (
					<p className="mt-2 text-sm text-cream">
						Кошелёк орга: {preview.wallet.haveLabel} · нужно {preview.wallet.neededLabel}
						{preview.wallet.shortfall > 0 ? ` · не хватает ${preview.wallet.shortfallLabel}` : ''}
					</p>
				)}
			</div>
			{preview.lines.length > 0 && (
				<ul className="space-y-2">
					{preview.lines.map((line) => (
						<li key={line.place} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-line px-3 py-2 text-sm">
							<div className="text-cream">
								{line.place} место · {line.teamName ?? 'команда ещё не известна'}
							</div>
							<div className="text-aegisSoft">
								{line.amountLabel}
								<span className="ml-2 text-xs text-muted">{statusLabel[line.status] ?? line.status}</span>
							</div>
						</li>
					))}
				</ul>
			)}
			<p className="text-xs text-muted">Всего: {preview.totalLabel}. Сплит 70/30 на кошельки капитанов 1 и 2 места (createdBy команды), не на всю пятёрку.</p>
			<ol className="space-y-1 text-[11px] text-muted">
				<li>{preview.canPay || preview.reason === 'already_paid' ? '✓' : '·'} Турнир FINISHED и есть победитель</li>
				<li>{preview.escrowReady ? '✓' : '·'} Фонд на эскроу</li>
				<li>
					{totpEnabled ? '✓' : '·'} Ключ выплаты в профиле{' '}
					{livePrize
						? totpEnabled
							? 'включён — без кода резерв и выплата не уйдут'
							: 'обязателен при живом призе'
						: totpEnabled
							? 'включён'
							: 'не нужен: фонда нет'}
				</li>
			</ol>
			{dryRun.length > 0 && (
				<div className="rounded-lg border border-line bg-black/20 px-3 py-2">
					<div className="text-[11px] uppercase tracking-wide text-aegisSoft">Прогон кубка до живого приза</div>
					<ol className="mt-1 list-decimal space-y-0.5 pl-4 text-[11px] text-muted">
						{dryRun.map((line) => (
							<li key={line}>{line}</li>
						))}
					</ol>
					{!totpEnabled && (
						<p className="mt-1 text-[11px] text-muted">
							Включите ключ на{' '}
											<Link href="/profile" className="text-aegisSoft hover:text-aegis">
								профиле
											</Link>
							, иначе резерв и выплата закроются.
						</p>
					)}
				</div>
			)}
			<div className="flex flex-wrap gap-2">
				{preview.canReserve && (
					<div className="flex flex-wrap items-center gap-2">
						{livePrize && (
							<input
								value={totp}
								onChange={(event) => setTotp(event.target.value)}
								maxLength={6}
								inputMode="numeric"
								placeholder="Код из приложения"
								className="w-40 rounded-lg border border-line bg-panel px-3 py-2 font-mono text-cream outline-none focus:border-aegis"
							/>
						)}
						<button
							type="button"
							disabled={
								busy ||
								!preview.wallet.canAfford ||
								(livePrize && (!totpEnabled || totp.length !== 6))
							}
							onClick={() => void send({ reserve: true, totp })}
							className="rounded-full border border-aegis/50 px-4 py-2 text-sm text-aegisSoft disabled:opacity-50"
						>
							Зарезервировать фонд
						</button>
						{!preview.wallet.canAfford && (
							<a href="/balance" className="text-sm text-aegisSoft hover:text-aegis">
								Пополнить баланс
							</a>
						)}
					</div>
				)}
				{preview.canPay && !open && (
					<button
						type="button"
						disabled={busy}
						onClick={() => setOpen(true)}
						className="rounded-full bg-aegis px-4 py-2 text-sm font-semibold text-ink disabled:opacity-50"
					>
						Выплатить призы
					</button>
				)}
			</div>
			{open && (
				<div className="space-y-2 rounded-lg border border-aegis/40 bg-aegis/10 p-3">
					<p className="text-sm text-cream">
						Подтвердите выплату {preview.totalLabel} капитанам 1 и 2 места. Операцию по уже выплаченным строкам повторить нельзя.
					</p>
					{livePrize && (
						<input
							value={totp}
							onChange={(event) => setTotp(event.target.value)}
							maxLength={6}
							inputMode="numeric"
							placeholder="Код из приложения"
							className="w-40 rounded-lg border border-line bg-panel px-3 py-2 font-mono text-cream outline-none focus:border-aegis"
						/>
					)}
					<div className="flex flex-wrap gap-2">
						<button
							type="button"
							disabled={busy || (livePrize && (!totpEnabled || totp.length !== 6))}
							onClick={() => void send({ confirm: true, totp })}
							className="rounded-full bg-aegis px-4 py-2 text-sm font-semibold text-ink disabled:opacity-50"
						>
							{busy ? 'Платим…' : 'Подтвердить выплату'}
						</button>
						<button type="button" disabled={busy} onClick={() => setOpen(false)} className="text-sm text-muted">
							Отмена
						</button>
					</div>
				</div>
			)}
			{error && <p className="text-sm text-red-200">{error}</p>}
			{done && <p className="text-sm text-aegisSoft">{done}</p>}
		</section>
	);
}
