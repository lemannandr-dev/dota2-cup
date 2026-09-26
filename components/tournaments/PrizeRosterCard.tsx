import type { PayoutPreview } from '@/lib/prize-places';

/** Public copy — never echo organizer wallet balance from preview.hint. */
function rosterFacingHint(preview: PayoutPreview) {
	if (preview.alreadyPaid) {
		return 'Выплата капитанам 1 и 2 места уже на балансе арены. Состав делит сам — сайт не режет 70/30 на пятерых.';
	}
	if (preview.canPay || preview.escrowReady) {
		return 'Фонд на эскроу. После «Завершить кубок» орг платит капитанам 1 и 2 места.';
	}
	if (preview.reason === 'unconfirmed' || preview.hint.includes('На кошельке')) {
		return 'Фонд ещё не зарезервирован — это не деньги на эскроу. Выплата капитанам — только после финала.';
	}
	return preview.hint;
}

export function PrizeRosterCard({ preview }: { preview: PayoutPreview }) {
	if (preview.reason === 'no_prize') return null;
	return (
		<section className="obsidian-glass rounded-card space-y-3 p-5">
			<div className="text-xs uppercase tracking-[0.18em] text-aegisSoft">Приз глазами состава</div>
			<p className="text-sm text-muted">{rosterFacingHint(preview)}</p>
			<ul className="space-y-1 text-sm text-cream">
				{preview.lines.map((line) => (
					<li key={line.place} className="flex flex-wrap justify-between gap-2 border-b border-line/50 py-1">
						<span>
							{line.place} место · {line.teamName ?? 'команда ещё не ясна'}
						</span>
						<span className="text-aegisSoft">
							{line.amountLabel} · {line.status === 'PAID' ? 'выплачено капитану' : line.status === 'RESERVED' ? 'ждёт капитана' : line.status}
						</span>
					</li>
				))}
			</ul>
		</section>
	);
}