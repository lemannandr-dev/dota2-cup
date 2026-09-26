'use client';

import { BroadcastPlayer, SeriesScore, useTournamentBroadcast } from '@/components/tournaments/BroadcastScoreboard';

export function BroadcastDesk({ tournamentId }: { tournamentId: string }) {
	const payload = useTournamentBroadcast(tournamentId);
	if (!payload || (!payload.hasDesk && !payload.pair)) return null;
	return (
		<section className="obsidian-glass rounded-card space-y-4 p-5">
			<div className="flex flex-wrap items-end justify-between gap-3">
				<div>
					<div className="text-xs uppercase tracking-wide text-muted">Прямой эфир стола</div>
					<h2 className="font-display text-2xl text-cream">{payload.title}</h2>
					<p className="mt-1 text-sm text-muted">
						Картинка — канал организатора. Счёт серии — с арены (репорты капитанов / судья), не net worth из катки.
						{payload.broadcast.delaySec > 0 ? ` Задержка стола: ${payload.broadcast.delaySec} с.` : ''}
					</p>
				</div>
				<a href={`/tournaments/${tournamentId}/watch`} className="text-sm text-aegisSoft hover:text-aegis">
					Открыть стол
				</a>
			</div>
			<SeriesScore payload={payload} />
			<div className="text-xs text-muted">
				{payload.pair ? `BO${payload.pair.bestOf}` : payload.seriesRules}
				{payload.broadcast.dotaTv ? ` · Dota TV ${payload.broadcast.dotaTv}` : ''}
				{payload.broadcast.lobbyName ? ` · лобби ${payload.broadcast.lobbyName}` : ''}
			</div>
			<BroadcastPlayer payload={payload} />
		</section>
	);
}
