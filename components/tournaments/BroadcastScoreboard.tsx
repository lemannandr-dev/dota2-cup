'use client';

import { useEffect, useState } from 'react';
import { twitchPlayerSrc } from '@/lib/twitch';
import type { ReadyCheckBoard } from '@/lib/ready-check';

export type BroadcastPayload = {
	title: string;
	status: string;
	seriesRules: string;
	hasDesk: boolean;
	broadcast: {
		twitch: string | null;
		dotaTv: string | null;
		lobbyName: string | null;
		delaySec: number;
	};
	sources: Array<{ id: string; label: string; kind: 'twitch' | 'youtube'; twitch?: string; embed?: string | null }>;
	pair: {
		scoreA: number;
		scoreB: number;
		bestOf: number;
		status: string;
		teamA: { name: string } | null;
		teamB: { name: string } | null;
		readyCheck?: ReadyCheckBoard | null;
	} | null;
};

export function useTournamentBroadcast(tournamentId: string) {
	const [data, setData] = useState<BroadcastPayload | null>(null);
	useEffect(() => {
		let cancelled = false;
		async function pull() {
			try {
				const res = await fetch(`/api/tournaments/${tournamentId}/broadcast`, { cache: 'no-store' });
				if (!res.ok || cancelled) return;
				const json = (await res.json()) as BroadcastPayload;
				if (!cancelled) setData(json);
			} catch {
				// рестарт web / HMR
			}
		}
		void pull();
		const timer = window.setInterval(pull, 4000);
		return () => {
			cancelled = true;
			window.clearInterval(timer);
		};
	}, [tournamentId]);
	return data;
}

export function SeriesScore({ payload, huge = false }: { payload: BroadcastPayload; huge?: boolean }) {
	const pair = payload.pair;
	return (
		<div className={`flex items-center justify-between gap-4 ${huge ? 'font-display' : ''}`}>
			<div className={`min-w-0 truncate text-cream ${huge ? 'text-3xl' : 'text-sm font-semibold'}`}>
				{pair?.teamA?.name ?? 'Команда A'}
			</div>
			<div className={`shrink-0 tabular-nums text-cream ${huge ? 'text-6xl' : 'text-2xl font-display'}`}>
				{pair?.scoreA ?? 0}:{pair?.scoreB ?? 0}
			</div>
			<div className={`min-w-0 truncate text-right text-cream ${huge ? 'text-3xl' : 'text-sm font-semibold'}`}>
				{pair?.teamB?.name ?? 'Команда B'}
			</div>
		</div>
	);
}

export function BroadcastPlayer({ payload }: { payload: BroadcastPayload }) {
	const [sourceId, setSourceId] = useState(payload.sources[0]?.id ?? '');
	const parent = typeof window !== 'undefined' ? window.location.hostname : 'localhost';
	const source = payload.sources.find((row) => row.id === sourceId) ?? payload.sources[0];
	if (!source) {
		return (
			<div className="flex aspect-video items-center justify-center rounded-card border border-line bg-panel text-sm text-muted">
				Официальный стол не указан. Организатор задаёт Twitch / YouTube при создании турнира.
			</div>
		);
	}
	const src = source.kind === 'twitch' && source.twitch ? twitchPlayerSrc(source.twitch, parent) : source.embed;
	return (
		<div className="space-y-2">
			{payload.sources.length > 1 && (
				<div className="flex flex-wrap gap-2">
					{payload.sources.map((row) => (
						<button
							key={row.id}
							type="button"
							onClick={() => setSourceId(row.id)}
							className={`rounded-full px-3 py-1 text-xs ${source?.id === row.id ? 'bg-aegis text-ink' : 'border border-line text-muted'}`}
						>
							{row.label}
						</button>
					))}
				</div>
			)}
			<div className="relative aspect-video overflow-hidden rounded-card bg-black">
				{src ? (
					<iframe title={source.label} src={src} className="absolute inset-0 h-full w-full" allow="autoplay; encrypted-media; picture-in-picture" allowFullScreen />
				) : (
					<div className="absolute inset-0 flex items-center justify-center text-sm text-muted">Не удалось собрать embed</div>
				)}
			</div>
		</div>
	);
}
