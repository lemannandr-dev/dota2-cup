'use client';

import { BroadcastPlayer, SeriesScore, useTournamentBroadcast } from '@/components/tournaments/BroadcastScoreboard';
import { ReadyCheckStrip } from '@/components/tournaments/ReadyCheckStrip';

export function WatchDesk({ tournamentId }: { tournamentId: string }) {
	const payload = useTournamentBroadcast(tournamentId);
	if (!payload) return <div className="text-sm text-muted">Загружаем стол…</div>;
	return (
		<div className="space-y-4">
			<div className="obsidian-glass rounded-card p-4 space-y-4">
				<SeriesScore payload={payload} huge />
				<div className="text-sm text-muted">
					{payload.pair ? `BO${payload.pair.bestOf} · ${payload.pair.status}` : 'Пара ещё не собрана'}
					{payload.broadcast.delaySec ? ` · задержка ${payload.broadcast.delaySec} с` : ''}
				</div>
				{payload.pair?.readyCheck && <ReadyCheckStrip board={payload.pair.readyCheck} />}
			</div>
			<BroadcastPlayer payload={payload} />
			{(payload.broadcast.dotaTv || payload.broadcast.lobbyName) && (
				<div className="obsidian-glass rounded-card p-4 text-sm text-cream">
					<div className="text-xs uppercase tracking-wide text-muted">Смотреть в клиенте</div>
					{payload.broadcast.lobbyName && <p className="mt-1">Лобби: {payload.broadcast.lobbyName}</p>}
					{payload.broadcast.dotaTv && <p className="mt-1 font-mono">Dota TV / Match ID: {payload.broadcast.dotaTv}</p>}
				</div>
			)}
			<p className="text-xs text-muted">
				Для OBS: браузерный источник{' '}
				<a href={`/overlay/tournaments/${tournamentId}`} className="text-aegisSoft hover:text-aegis">
					/overlay/tournaments/{tournamentId}
				</a>
				. Ширина 1920, высота 280, без шапки сайта.
			</p>
		</div>
	);
}
