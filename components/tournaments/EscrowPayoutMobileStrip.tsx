'use client';

import { useState } from 'react';
import type { PayoutPreview } from '@/lib/prize-places';
import { escrowPayoutStrip } from '@/lib/tournament-create-wizard';
import { BottomSheet } from '@/components/ui/BottomSheet';

const toneClass = {
	muted: 'border-line',
	warn: 'border-red-400/50',
	ok: 'border-radiant/40',
	ready: 'border-aegis/50'
} as const;

/** Mobile-first escrow / payout summary with sheet for the full desk. */
export function EscrowPayoutMobileStrip({ preview }: { preview: PayoutPreview }) {
	const [open, setOpen] = useState(false);
	if (preview.reason === 'no_prize' && preview.lines.length === 0) return null;
	const strip = escrowPayoutStrip(preview);

	return (
		<>
			<button
				type="button"
				onClick={() => setOpen(true)}
				className={`obsidian-glass flex w-full min-h-14 flex-col justify-center rounded-card border px-4 py-3 text-left md:hidden ${toneClass[strip.tone]}`}
				data-escrow-strip="true"
			>
				<div className="flex flex-wrap items-center justify-between gap-2">
					<span className="text-sm font-semibold text-cream">{strip.status}</span>
					<span className="font-mono text-sm text-aegisSoft">{strip.totalLabel}</span>
				</div>
				<p className="mt-1 text-xs text-muted">{strip.walletLine}</p>
				<p className="mt-1 text-[11px] text-aegisSoft">Нажмите — детали 70/30 и статус эскроу</p>
			</button>

			<BottomSheet open={open} onClose={() => setOpen(false)} title="Эскроу и выплата" description={strip.hint}>
				<div className="space-y-3 text-sm">
					<p className="text-cream">{strip.walletLine}</p>
					<ul className="space-y-2">
						{preview.lines.map((line) => (
							<li key={line.place} className="flex justify-between gap-2 border-b border-line/50 py-2">
								<span className="text-cream">
									{line.place} место · {line.teamName ?? 'команда ещё не ясна'}
								</span>
								<span className="text-aegisSoft">{line.amountLabel}</span>
							</li>
						))}
					</ul>
					<ol className="space-y-1 text-xs text-muted">
						<li>{preview.canPay || preview.alreadyPaid ? '✓' : '·'} Финал закрыт</li>
						<li>{preview.escrowReady ? '✓' : '·'} Фонд на эскроу</li>
						<li>{preview.canReserve ? '→' : '·'} Резерв и выплата — на карточке под полоской</li>
					</ol>
					<button type="button" onClick={() => setOpen(false)} className="aegis-action mt-2 inline-flex min-h-12 w-full items-center justify-center rounded-lg bg-aegis px-4 text-sm font-semibold text-ink">
						К действиям на карточке
					</button>
				</div>
			</BottomSheet>
		</>
	);
}
