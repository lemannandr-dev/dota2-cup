'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { Search, UserPlus, X } from 'lucide-react';
import { SteamAvatar } from '@/components/desk/SteamAvatar';
import { SteamButton } from '@/components/dota/SteamButton';
import { RankMedal } from '@/components/dota/RankMedal';
import type { InviteTarget } from '@/components/players/PartyPanel';
import type { PartyPlayer } from '@/lib/party-search';
import { partySearchHref } from '@/lib/team-roster';
import { formatStoredArenaRating } from '@/lib/arena-rating';
import { medalCaption } from '@/lib/dota-rank';

type Props = {
	players: PartyPlayer[];
	currentUserId: string | null;
	onInvite?: (target: InviteTarget) => void;
	initialTournamentId?: string | null;
	initialQuery?: string | null;
	focusPlayerId?: string | null;
	onlineOnly?: boolean;
};

export function PlayerSearchTable({ players, currentUserId, onInvite, initialTournamentId, initialQuery, focusPlayerId, onlineOnly = false }: Props) {
	const [query, setQuery] = useState(initialQuery ?? '');
	const [focusedId, setFocusedId] = useState(focusPlayerId ?? null);
	const filtered = useMemo(() => {
		const value = query.trim().toLowerCase();
		return players.filter((player) => (!focusedId || player.id === focusedId) && (!onlineOnly || player.isOnline)
			&& (!value || [player.displayName, player.username, player.steamId].some((field) => field?.toLowerCase().includes(value))));
	}, [players, query, focusedId, onlineOnly]);

	return <div className="min-w-0 space-y-4">
		<div className="flex flex-wrap items-end gap-3">
			<label className="min-w-0 flex-1 space-y-2">
				<span className="text-sm text-cream">Поиск игрока</span>
				<span className="relative block">
					<Search size={18} className="pointer-events-none absolute left-3 top-3.5 text-muted" aria-hidden="true" />
					<input value={query} onChange={(event) => { setQuery(event.target.value); setFocusedId(null); }} className="min-h-11 w-full rounded-lg border border-line bg-panel py-2 pl-10 pr-3 text-base text-cream outline-none focus:border-aegis" placeholder="Ник или Steam ID" />
				</span>
			</label>
			{(query || focusedId) && <button type="button" aria-label="Сбросить поиск" title="Показать всех игроков" onClick={() => { setQuery(''); setFocusedId(null); }} className="party-icon"><X size={18} aria-hidden="true" /></button>}
		</div>
		<p className="text-xs text-muted" role="status">Найдено игроков: {filtered.length}</p>
		<div className="divide-y divide-line border-y border-line">
			{filtered.map((player) => {
				const isSelf = player.id === currentUserId;
				const next = partySearchHref({ playerId: player.id, tournamentId: initialTournamentId });
				return <article key={player.id} className="grid min-w-0 gap-3 py-4 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] md:items-center">
					<div className="flex min-w-0 items-center gap-3">
						<SteamAvatar url={player.avatarUrl} name={player.displayName} className="h-11 w-11 shrink-0" />
						<div className="min-w-0">
							<Link href={`/players/${player.id}`} className="block break-words text-sm font-semibold text-cream hover:text-aegisSoft">{player.displayName}</Link>
							<p className={`mt-1 text-xs ${player.isOnline ? 'text-radiant' : 'text-muted'}`}>{player.isOnline ? 'На арене' : 'Не на арене'}{player.username ? ` · @${player.username}` : ''}</p>
						</div>
					</div>
					<div className="flex min-w-0 items-center gap-3 text-xs text-muted">
						{player.medal && <RankMedal {...player.medal} size={36} showLabel={false} />}
						<div className="min-w-0 space-y-1">
							{player.medal && <p className="text-cream">{medalCaption(player.medal)}</p>}
							<p>Арена: {formatStoredArenaRating(player.rating, player.ratingGames ?? 0)}</p>
							<p>Уровень {player.level} · Steam {player.steamId ? 'подтверждён' : 'не привязан'}</p>
						</div>
					</div>
					{isSelf || !player.steamId ? <button type="button" disabled className="party-command text-muted">{isSelf ? 'Это вы' : 'Нет Steam'}</button>
						: !currentUserId ? <SteamButton next={next} className="justify-center" />
							: onInvite ? <button type="button" className="party-command text-cyan-200" onClick={() => onInvite({ id: player.id, displayName: player.displayName, tournamentId: initialTournamentId || undefined })}><UserPlus size={18} aria-hidden="true" />Пригласить в пати</button>
								: <Link href={next} className="party-command text-cyan-200"><UserPlus size={18} aria-hidden="true" />Пригласить в пати</Link>}
				</article>;
			})}
			{filtered.length === 0 && <p className="py-8 text-sm text-muted">Игроки не найдены.</p>}
		</div>
	</div>;
}
