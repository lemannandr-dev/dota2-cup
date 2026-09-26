import type { CupTrophyView } from '@/lib/cup-trophy';
import { CupGlyph } from '@/components/cups/DotaTrophy3D';
import { aegisAwardOf } from '@/lib/aegis-awards';
import { CupHighlights } from '@/components/cups/CupHighlights';
import { playerCardHref } from '@/lib/site';

function TeamFold({
	place,
	name,
	href,
	players
}: {
	place: 1 | 2;
	name: string;
	href: string;
	players: CupTrophyView['players'];
}) {
	return (
		<details className="rounded-xl border border-[#C9A227]/25 bg-black/20 px-3 py-2 text-left">
			<summary className="cursor-pointer list-none font-display text-cream marker:content-none">
				<span className="text-[10px] uppercase tracking-[0.16em] text-[#F8E7A0]/75">
					{place === 1 ? 'Победители финала' : 'Финал · 2 место'}
				</span>
				<span className="mt-0.5 block text-sm">{name}</span>
				<span className="mt-0.5 block text-[11px] text-muted">
					{players.length ? `нажми — состав ${players.length}` : 'состав на финал не записан'}
				</span>
			</summary>
			<div className="mt-2 space-y-2 border-t border-line/50 pt-2">
				<a href={href} className="text-xs text-aegisSoft hover:text-aegis">
					Открыть команду в каталоге
				</a>
				{players.length > 0 && (
					<ul className="space-y-1">
						{players.map((player) => (
							<li key={`${player.steamNick}-${player.steamId ?? player.userId ?? player.displayName}`} className="text-xs text-cream">
								{player.userId ? (
									<a href={playerCardHref(player.userId)} className="hover:text-aegisSoft">
										{player.steamNick}
									</a>
								) : (
									player.steamNick
								)}
								{player.steamId ? <span className="text-muted"> · {player.steamId}</span> : null}
							</li>
						))}
					</ul>
				)}
			</div>
		</details>
	);
}

export function CupTrophy({ trophy, compact = false }: { trophy: CupTrophyView; compact?: boolean }) {
	const body = (
		<div className={`flex flex-col gap-5 ${compact ? '' : 'lg:flex-row lg:items-stretch'}`}>
			<div className={`relative mx-auto shrink-0 ${compact ? 'h-56 w-40' : 'h-[22rem] w-56'}`}>
				<CupGlyph
					year={trophy.year}
					showYear
					title={trophy.title}
					accent={trophy.award?.id ?? 'ember'}
					subtitle={trophy.award?.plaque ?? 'КИБЕРСПОРТИВНЫЙ ТУРНИР'}
					caption={trophy.award?.caption ?? 'среди команд по Dota 2'}
					className="h-full w-full"
				/>
			</div>
			<div className="min-w-0 flex-1 space-y-3 text-center lg:text-left">
				<p className="text-[10px] uppercase tracking-[0.22em] text-[#F8E7A0]/80">
					{(trophy.award ?? aegisAwardOf('ember')).name} · {trophy.year}
				</p>
				<h2 className={`font-display text-cream ${compact ? 'text-xl' : 'text-2xl'}`}>{trophy.title}</h2>
				<p className={`font-display text-[#E8D0B0] ${compact ? 'text-base' : 'text-lg'}`}>
					Гравировка: {trophy.engraving}
				</p>
				<div className="flex flex-wrap items-center justify-center gap-2 lg:justify-start">
					<span className="rounded-full border border-[#C9A227]/40 bg-black/30 px-2.5 py-1 text-[11px] text-[#F8E7A0]">
						Приз · {trophy.prizeLabel}
					</span>
					{trophy.finalScore && (
						<span className="rounded-full border border-line px-2.5 py-1 text-[11px] text-cream">
							Финал {trophy.finalScore}
							{trophy.runnerUpTeamName ? ` · ${trophy.engraving} / ${trophy.runnerUpTeamName}` : ''}
						</span>
					)}
				</div>
				{trophy.prizeHint && <p className="text-[11px] leading-5 text-muted">{trophy.prizeHint}</p>}
				<p className="text-sm leading-6 text-muted">{trophy.description}</p>
				{compact ? (
					<ul className="flex flex-wrap justify-center gap-2 lg:justify-start">
						{trophy.players.map((player) => (
							<li
								key={`${player.steamNick}-${player.steamId ?? player.userId ?? player.displayName}`}
								className="rounded-full border border-[#C47A48]/40 bg-black/30 px-3 py-1 text-xs text-cream"
							>
								{player.steamNick}
								{player.steamId ? ` · ${player.steamId}` : ''}
							</li>
						))}
					</ul>
				) : (
					<>
						<p className="text-[11px] leading-5 text-muted">
							Состав чемпионов — ниже. Статы героев из реплея здесь не подставляем.
						</p>
						<div className="grid gap-2 sm:grid-cols-2">
							{trophy.teams.map((team) => (
								<TeamFold
									key={`${team.place}-${team.id}`}
									place={team.place}
									name={team.name}
									href={team.href}
									players={team.players}
								/>
							))}
						</div>
					</>
				)}
			</div>
			{!compact && (
				<div className="w-full shrink-0 lg:w-[22rem] xl:w-[26rem]">
					<CupHighlights items={trophy.highlights} />
				</div>
			)}
		</div>
	);

	if (trophy.href && compact) {
		return (
			<a href={trophy.href} className="obsidian-glass block overflow-hidden rounded-card p-6 hover:ring-1 hover:ring-[#C47A48]/40">
				{body}
			</a>
		);
	}

	return <section className="obsidian-glass overflow-hidden rounded-card p-6">{body}</section>;
}
