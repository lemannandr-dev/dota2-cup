'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { StatusPill } from '@/components/dota/StatusPill';
import { RankMedal } from '@/components/dota/RankMedal';
import { MmrGlow } from '@/components/dota/MmrGlow';
import { DeskMenu, bindDeskMenuClose, clampMenu } from '@/components/desk/DeskMenu';
import { formatMoscowLabel } from '@/lib/datetime';
import { formatStoredArenaRating } from '@/lib/arena-rating';
import { SteamAvatar } from '@/components/desk/SteamAvatar';
import { CupMark } from '@/components/cups/CupMark';
import { partySearchHref } from '@/lib/team-roster';
import {
	catalogInviteHint,
	catalogInviteHref,
	catalogLfgLine,
	catalogMatchesFilter,
	type CatalogPlayer,
	type CatalogViewer,
	type PlayersFilter
} from '@/lib/players-catalog';

type Props = { players: CatalogPlayer[]; viewer: CatalogViewer };

export function PlayersDesk({ players, viewer }: Props) {
	const [query, setQuery] = useState('');
	const [tab, setTab] = useState<PlayersFilter>('ALL');
	const [menu, setMenu] = useState<{ x: number; y: number; player?: CatalogPlayer } | null>(null);
	const search = query.trim().toLowerCase();

	const onlineCount = players.filter((player) => player.online).length;
	const ratedCount = players.filter((player) => player.ratingGames > 0).length;
	const steamCount = players.filter((player) => Boolean(player.steamId)).length;
	const lfgCount = players.filter((player) => Boolean(player.lfg)).length;
	const champCount = players.filter((player) => player.championships.length > 0).length;

	const visible = useMemo(() => {
		return players.filter((player) => {
			if (!catalogMatchesFilter(player, tab)) return false;
			if (!search) return true;
			return [
				player.displayName,
				player.username,
				player.steamId,
				player.team?.name,
				player.lfg?.note,
				player.lfg?.cupTitle,
				...player.championships.map((cup) => cup.title)
			]
				.filter(Boolean)
				.some((field) => field!.toLowerCase().includes(search));
		});
	}, [players, search, tab]);

	useEffect(() => {
		if (!menu) return;
		return bindDeskMenuClose(() => setMenu(null), '#players-desk-menu, [aria-label="Действия игрока"], [aria-label="Действия каталога"]');
	}, [menu]);

	function placeMenu(player: CatalogPlayer | undefined, x: number, y: number) {
		setMenu({ ...clampMenu(x, y), player });
	}

	const chips: Array<{ id: PlayersFilter; label: string; count: number; show: boolean }> = [
		{ id: 'ALL', label: 'Все', count: players.length, show: true },
		{ id: 'ONLINE', label: 'На арене', count: onlineCount, show: true },
		{ id: 'RATED', label: 'С играми', count: ratedCount, show: true },
		{ id: 'STEAM', label: 'Steam', count: steamCount, show: true },
		{ id: 'LFG', label: 'Ищут пати', count: lfgCount, show: true },
		{ id: 'CHAMPS', label: 'Кубок', count: champCount, show: champCount > 0 }
	];

	const filterHint =
		tab === 'ONLINE'
			? 'фильтр: заход на сайт за 15 минут, не клиент Dota'
			: tab === 'RATED'
				? 'фильтр: есть закрытые пары арены, не медаль OpenDota'
				: tab === 'STEAM'
					? 'фильтр: привязан Steam'
					: tab === 'LFG'
						? 'фильтр: живая заявка в поиске пати'
						: tab === 'CHAMPS'
							? 'фильтр: чемпионы завершённого финала'
							: 'все игроки';

	return (
		<div
			className="space-y-5"
			data-players-desk="true"
			onContextMenu={(event) => {
				const node = event.target as HTMLElement | null;
				if (node?.closest('input,textarea,a,button,article')) return;
				event.preventDefault();
				placeMenu(undefined, event.clientX, event.clientY);
			}}
		>
			<section className="obsidian-glass rounded-card p-4 md:p-5">
				<div className="flex items-start justify-between gap-3">
					<div className="min-w-0">
						<h1 className="font-display text-3xl text-cream">Игроки</h1>
						<p className="mt-2 text-sm text-muted">
							{players.length} в каталоге
							{onlineCount ? ` · на арене ${onlineCount}` : ''}
							{ratedCount ? ` · с играми ${ratedCount}` : ''}
							{lfgCount ? ` · ищут пати ${lfgCount}` : ''}
						</p>
						<p className="mt-1 text-xs text-muted">{filterHint}. Рейтинг арены только из пар. MMR — кэш OpenDota.</p>
					</div>
					<div className="flex shrink-0 items-center gap-2">
						<input
							value={query}
							onChange={(event) => setQuery(event.target.value)}
							placeholder="Ник или SteamID"
							className="hidden w-48 rounded-full border border-line bg-panel px-3 py-1.5 text-sm text-cream outline-none focus:border-aegis sm:block"
						/>
						<button
							type="button"
							aria-label="Действия каталога"
							onClick={(event) => {
								const rect = event.currentTarget.getBoundingClientRect();
								placeMenu(undefined, rect.right - 240, rect.bottom + 6);
							}}
							className="rounded-lg border border-line px-2.5 py-1 text-sm text-muted hover:text-cream"
						>
							⋯
						</button>
					</div>
				</div>
				<input
					value={query}
					onChange={(event) => setQuery(event.target.value)}
					placeholder="Ник, команда или SteamID"
					aria-label="Поиск игрока"
					className="mt-3 w-full rounded-full border border-line bg-panel px-4 py-2 text-sm text-cream outline-none focus:border-aegis sm:hidden"
				/>
				<div className="mt-3 flex flex-wrap gap-2" role="tablist" aria-label="Фильтр игроков">
					{chips
						.filter((chip) => chip.show)
						.map((chip) => (
							<button
								key={chip.id}
								type="button"
								role="tab"
								aria-selected={tab === chip.id}
								onClick={() => setTab(chip.id)}
								className={`inline-flex min-h-9 items-center rounded-full border px-3 text-xs ${
									tab === chip.id ? 'border-aegis bg-aegis/15 text-aegisSoft' : 'border-line text-muted hover:text-cream'
								}`}
							>
								{chip.label} · {chip.count}
							</button>
						))}
				</div>
			</section>

			{visible.length === 0 ? (
				<div className="obsidian-glass rounded-card p-8 text-sm text-muted">
					{players.length === 0
						? 'Игроков пока нет. Войдите через Steam, чтобы появился первый профиль.'
						: tab === 'LFG'
							? 'Живых заявок в этом списке нет. Открыть поиск пати.'
							: 'Никого не нашлось по этому фильтру.'}
					{tab === 'LFG' && (
						<div className="mt-3">
							<a href={partySearchHref({ tab: 'lfg' })} className="text-aegisSoft hover:text-aegis">
								К поиску пати
							</a>
						</div>
					)}
				</div>
			) : (
				<div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
					{visible.map((player) => {
						const isSelf = viewer.id === player.id;
						const inviteHref = catalogInviteHref({
							playerId: player.id,
							displayName: player.displayName,
							viewer,
							isSelf,
							steamId: player.steamId
						});
						return (
							<article
								key={player.id}
								onContextMenu={(event) => {
									event.preventDefault();
									event.stopPropagation();
									placeMenu(player, event.clientX, event.clientY);
								}}
								className={`obsidian-glass flex h-full min-w-0 flex-col overflow-visible rounded-card p-3.5 ${isSelf ? 'ring-1 ring-aegis/40' : ''}`}
							>
								<div className="flex items-start gap-2.5">
									<a href={player.href} className="shrink-0" title="Открыть визитку">
										<span className="flex items-center justify-center gap-0.5">
											<SteamAvatar
												url={player.avatarUrl}
												name={player.displayName}
												className={`h-10 w-10 border ${player.online ? 'border-radiant/70' : 'border-line'}`}
											/>
											{player.medal && (
												<RankMedal
													tier={player.medal.tier}
													stars={player.medal.stars}
													leaderboard={player.medal.leaderboard}
													size={28}
													showLabel={false}
												/>
											)}
										</span>
									</a>
									<div className="min-w-0 flex-1">
										<div className="flex min-w-0 items-center gap-1.5">
											<span
												className={`h-1.5 w-1.5 shrink-0 rounded-full ${player.online ? 'bg-radiant shadow-[0_0_0_3px_rgba(74,222,128,0.18)]' : 'bg-muted/60'}`}
												title={player.online ? 'на арене' : 'оффлайн'}
												aria-label={player.online ? 'на арене' : 'оффлайн'}
											/>
											<a href={player.href} className="min-w-0 truncate font-semibold leading-5 text-cream hover:text-aegisSoft">
												{player.displayName}
											</a>
											{player.mmr && (
												<span className="shrink-0">
													<MmrGlow mmr={player.mmr} />
												</span>
											)}
										</div>
										<p className="mt-0.5 truncate text-[11px] leading-4 text-muted">
											{player.username ? `@${player.username}` : player.team ? player.team.name : `#${player.id.slice(-6)}`}
										</p>
									</div>
									<div className="flex shrink-0 flex-col items-end gap-1">
										<div className="flex flex-wrap justify-end gap-1">
											{isSelf && (
												<StatusPill compact tone="aegis">
													это вы
												</StatusPill>
											)}
											{player.online && (
												<StatusPill compact tone="radiant">
													на арене
												</StatusPill>
											)}
											{player.lfg && (
												<StatusPill compact tone="info">
													ищет пати
												</StatusPill>
											)}
										</div>
										<button
											type="button"
											aria-label="Действия игрока"
											onClick={(event) => {
												event.stopPropagation();
												const rect = event.currentTarget.getBoundingClientRect();
												placeMenu(player, rect.right - 240, rect.bottom + 6);
											}}
											className="rounded-lg border border-line px-2 py-1 text-sm text-muted hover:text-cream"
										>
											⋯
										</button>
									</div>
								</div>
								<p className="mt-2 text-[11px] leading-4 text-muted">
									арена {formatStoredArenaRating(player.rating, player.ratingGames)}
									{!player.mmr ? ` · ${player.steamId ? 'без MMR' : 'нет Steam'}` : ''}
								</p>
								{player.team && (
									<p className="mt-1 truncate text-[11px] leading-4 text-cream">
										{player.team.name}
										{' · '}
										{player.team.needed > 0 ? `Steam ${player.team.withSteam} из 5` : 'состав 5 из 5 Steam'}
										{' · '}
										{player.team.roleLabel}
										{player.team.extraTeams > 0 ? ` · ещё ${player.team.extraTeams}` : ''}
									</p>
								)}
								{player.lfg && <p className="mt-1 truncate text-[11px] leading-4 text-aegisSoft">{catalogLfgLine(player.lfg)}</p>}
								{player.openCup && !player.lfg && (
									<p className="mt-1 truncate text-[11px] leading-4 text-muted">{player.openCup.hint}</p>
								)}
								<div className="mt-auto flex items-end justify-between gap-2 pt-3">
									<div className="flex min-w-0 items-end gap-2">
										{player.championships.slice(0, 3).map((mark) => (
											<CupMark key={mark.tournamentId} cup={mark} size="icon" />
										))}
										<p className="min-w-0 truncate text-[11px] leading-4 text-muted">
											{player.lastLoginAt ? `вход ${formatMoscowLabel(player.lastLoginAt)}` : 'вход —'}
										</p>
									</div>
									<a
										href={inviteHref ?? player.href}
										className="inline-flex min-h-9 shrink-0 items-center rounded-full border border-aegis/40 bg-aegis/10 px-3 text-xs font-semibold text-aegisSoft hover:border-aegis"
									>
										{inviteHref ? 'Пригласить' : isSelf ? 'Визитка' : 'Открыть'}
									</a>
								</div>
							</article>
						);
					})}
				</div>
			)}

			{menu && (
				<DeskMenu
					menuId="players-desk-menu"
					title={menu.player?.displayName ?? 'Каталог игроков'}
					x={menu.x}
					y={menu.y}
					items={
						menu.player
							? playerMenuItems(menu.player, viewer)
							: [
									...chips
										.filter((chip) => chip.show)
										.map((chip) => ({
											id: chip.id,
											label: `${chip.label} (${chip.count})`,
											hint: tab === chip.id ? 'Сейчас открыт' : 'Показать этот фильтр',
											onSelect: () => {
												setTab(chip.id);
												setMenu(null);
											}
										})),
									{ id: 'lfg-page', label: 'Поиск пати', hint: 'Живые заявки и приглашение в состав', href: partySearchHref({ tab: 'lfg' }) },
									{ id: 'teams', label: 'Каталог команд', hint: 'Составы и вызов на катку', href: '/teams' }
								]
					}
				/>
			)}
		</div>
	);
}

function playerMenuItems(player: CatalogPlayer, viewer: CatalogViewer) {
	const isSelf = viewer.id === player.id;
	const inviteHref = catalogInviteHref({
		playerId: player.id,
		displayName: player.displayName,
		viewer,
		isSelf,
		steamId: player.steamId
	});
	const hint = catalogInviteHint({ isSelf, canInvite: viewer.canInvite, steamId: player.steamId });
	return [
		{ id: 'card', label: isSelf ? 'Моя визитка' : 'Визитка', hint: 'Команда, кубки и рейтинг арены', href: player.href },
		inviteHref
			? { id: 'invite', label: 'Пригласить в команду', hint, href: inviteHref }
			: {
					id: 'invite-blocked',
					label: isSelf ? 'Это вы' : viewer.id ? (player.steamId ? 'Сначала своя пятёрка' : 'Нужен Steam') : 'Войти через Steam',
					hint,
					href: isSelf ? player.href : viewer.id ? '/teams' : '/api/auth/steam'
				},
		...(player.lfg ? [{ id: 'lfg', label: 'Заявка в поиске', hint: catalogLfgLine(player.lfg), href: partySearchHref({ tab: 'lfg', q: player.displayName }) }] : []),
		...(player.team ? [{ id: 'team', label: player.team.name, hint: `Steam ${player.team.withSteam} из 5 · ${player.team.roleLabel}`, href: `/teams?team=${player.team.id}` }] : []),
		...(player.openCup ? [{ id: 'cup-open', label: player.openCup.title, hint: player.openCup.hint, href: player.openCup.href }] : []),
		...(player.championships.map((cup) => ({
			id: `cup-${cup.tournamentId}`,
			label: cup.showcase ? `Витрина ${cup.year}` : `Кубок ${cup.year}`,
			hint: `${cup.title} · ${cup.winnerTeamName}`,
			href: cup.href
		})))
	];
}
