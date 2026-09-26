'use client';

import { SeriesScore, useTournamentBroadcast } from '@/components/tournaments/BroadcastScoreboard';
import { ReadyCheckStrip } from '@/components/tournaments/ReadyCheckStrip';

export function OverlayBar({ tournamentId }: { tournamentId: string }) {
	const payload = useTournamentBroadcast(tournamentId);
	if (!payload) return null;
	return (
		<div className="mx-auto flex max-w-6xl flex-col gap-3 rounded-2xl border border-white/15 bg-black/75 px-8 py-5 shadow-2xl backdrop-blur">
			<div className="flex items-center gap-6">
				<div className="shrink-0 text-xs font-semibold uppercase tracking-[0.2em] text-red-300">● Live</div>
				<div className="min-w-0 flex-1">
					<div className="text-[11px] uppercase tracking-wide text-white/50">{payload.title}</div>
					<SeriesScore payload={payload} huge />
				</div>
				<div className="shrink-0 text-right text-xs text-white/60">
					<div>BO{payload.pair?.bestOf ?? 1}</div>
					<div>счёт арены</div>
				</div>
			</div>
			{payload.pair?.readyCheck && <ReadyCheckStrip board={payload.pair.readyCheck} compact />}
		</div>
	);
}
