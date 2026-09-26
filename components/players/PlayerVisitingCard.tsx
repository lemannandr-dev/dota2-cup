import { CupMark } from '@/components/cups/CupMark';
import Link from 'next/link';
import { SteamAvatar } from '@/components/desk/SteamAvatar';
import { RankMedal } from '@/components/dota/RankMedal';
import { MmrGlow } from '@/components/dota/MmrGlow';
import { StatusPill } from '@/components/dota/StatusPill';
import { TeamRosterSlots } from '@/components/teams/TeamRosterSlots';
import { formatMoscowLabel } from '@/lib/datetime';
import { formatStoredArenaRating } from '@/lib/arena-rating';
import { catalogInviteHint, catalogInviteHref, catalogLfgLine, catalogPlayerLine } from '@/lib/players-catalog';
import { partySearchHref } from '@/lib/team-roster';
import { teamDeskHref } from '@/lib/site';
import type { PlayerCardView } from '@/server/players/card';

export function PlayerVisitingCard({ card }: { card: PlayerCardView }) {
	const { player, members, viewer, isSelf } = card;
	const inviteHref = catalogInviteHref({
		playerId: player.id,
		displayName: player.displayName,
		viewer,
		isSelf,
		steamId: player.steamId
	});
	const inviteHint = catalogInviteHint({ isSelf, canInvite: viewer.canInvite, steamId: player.steamId });

	return (
		<article className="obsidian-glass rounded-card p-5 md:p-6">
			<div className="flex flex-wrap items-start gap-4">
				<span className="flex items-center gap-1">
					<SteamAvatar
						url={player.avatarUrl}
						name={player.displayName}
						className={`h-16 w-16 border ${player.online ? 'border-radiant/70' : 'border-line'}`}
					/>
					{player.medal && (
						<RankMedal
							tier={player.medal.tier}
							stars={player.medal.stars}
							leaderboard={player.medal.leaderboard}
							size={40}
							showLabel={false}
						/>
					)}
				</span>
				<div className="min-w-0 flex-1">
					<p className="text-[10px] uppercase tracking-[0.18em] text-aegisSoft">Визитка игрока</p>
					<h1 className="mt-1 font-display text-3xl text-cream">{player.displayName}</h1>
					<p className="mt-1 text-sm text-muted">
						{player.username ? `@${player.username}` : `#${player.id.slice(-6)}`}
						{player.steamId ? ` · Steam ${player.steamId}` : ' · Steam не привязан'}
					</p>
					<div className="mt-3 flex flex-wrap gap-1.5">
						{isSelf && <StatusPill tone="aegis">это вы</StatusPill>}
						<StatusPill tone={player.online ? 'radiant' : 'muted'}>{player.online ? 'на арене' : 'оффлайн'}</StatusPill>
						<StatusPill tone={player.steamId ? 'radiant' : 'muted'}>{player.steamId ? 'Steam' : 'без Steam'}</StatusPill>
						{player.lfg && <StatusPill tone="info">ищет пати</StatusPill>}
						{player.championships[0] && <StatusPill tone="aegis">чемпион {player.championships[0].year}</StatusPill>}
					</div>
				</div>
			</div>

			<div className="mt-5 space-y-2">
				<div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
					{player.mmr ? (
						<MmrGlow mmr={player.mmr} size="md" />
					) : (
						<span className="text-sm text-muted">{catalogPlayerLine(player)}</span>
					)}
					{player.mmr && (
						<span className="text-sm text-muted">арена {formatStoredArenaRating(player.rating, player.ratingGames)}</span>
					)}
				</div>
				<p className="text-sm text-muted">
					{player.lastLoginAt ? `вход ${formatMoscowLabel(player.lastLoginAt)}` : 'вход —'}.
					Рейтинг арены только из закрытых пар (+16 / −12). MMR — с OpenDota, не выдуман. «На арене» — заход на сайт за 15 минут.
				</p>
			</div>

			{player.team ? (
				<div className="mt-5">
					<div className="flex items-start justify-between gap-3">
						<div className="min-w-0">
							<p className="text-[10px] uppercase tracking-[0.16em] text-aegisSoft">Команда</p>
							<a href={teamDeskHref(player.team.id)} className="mt-1 block truncate font-display text-xl text-cream hover:text-aegisSoft">
								{player.team.name}
							</a>
							<p className="mt-1 text-xs text-muted">
								{player.team.needed > 0 ? `Steam ${player.team.withSteam} из 5` : 'состав 5 из 5 Steam'}
								{' · '}
								{player.team.roleLabel}
								{player.team.extraTeams > 0 ? ` · ещё ${player.team.extraTeams} команд` : ''}
							</p>
						</div>
					</div>
					<div className="mt-3">
						<TeamRosterSlots members={members} teamId={player.team.id} tournamentId={player.openCup?.id} />
					</div>
				</div>
			) : (
				<p className="mt-5 text-sm text-muted">В подтверждённой пятёрке пока нет.</p>
			)}

			{player.openCup && (
				<div className="mt-5 rounded-lg border border-line bg-black/20 px-3 py-2.5">
					<p className="text-[10px] uppercase tracking-[0.16em] text-muted">Открытый кубок</p>
					<a href={player.openCup.href} className="mt-1 block font-semibold text-cream hover:text-aegisSoft">
						{player.openCup.title}
					</a>
					<p className="mt-1 text-xs text-muted">{player.openCup.hint}</p>
				</div>
			)}

			{player.lfg && (
				<div className="mt-5 rounded-lg border border-aegis/30 bg-aegis/10 px-3 py-2.5">
					<p className="text-[10px] uppercase tracking-[0.16em] text-aegisSoft">Ищет пати</p>
					<p className="mt-1 text-sm text-cream">{catalogLfgLine(player.lfg)}</p>
					<a href={partySearchHref({ tab: 'lfg', q: player.displayName })} className="mt-2 inline-block text-xs text-aegisSoft hover:text-aegis">
						Открыть заявку в поиске
					</a>
				</div>
			)}

			{player.championships.length > 0 ? (
				<div className="mt-5 space-y-2">
					<p className="text-[10px] uppercase tracking-[0.16em] text-[#F8E7A0]/80">Кубки</p>
					{player.championships.map((cup) => (
						<CupMark key={cup.tournamentId} cup={cup} size="xs" />
					))}
				</div>
			) : (
				<p className="mt-5 text-sm text-muted">Кубка нет — финал ещё не выигран.</p>
			)}

			<div className="mt-6 flex flex-wrap gap-3 text-sm">
				<Link href="/party-search?tab=players" className="text-aegisSoft hover:text-aegis">
					← Все игроки
				</Link>
				{isSelf && (
					<Link href={`/profile/${player.id}`} className="text-muted hover:text-cream">
						Мой кабинет профиля
					</Link>
				)}
				{inviteHref ? (
					<a href={inviteHref} className="text-muted hover:text-cream" title={inviteHint}>
						Пригласить в пати
					</a>
				) : !isSelf && viewer.id ? (
					<a href="/teams" className="text-muted hover:text-cream" title={inviteHint}>
						{inviteHint}
					</a>
				) : null}
			</div>
		</article>
	);
}
