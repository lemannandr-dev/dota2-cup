import { redirect } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import Image from 'next/image';
import { syncSteamProfileIfNeeded } from '@/lib/steam-profile-sync';
import { fetchDotaProfileAnalyticsBySteamId, formatRankTier } from '@/lib/dota-stats';
import { RankMedal } from '@/components/dota/RankMedal';
import { formatOpenDotaMmr, pickOpenDotaMmr, rankMedalFromTier, storedOpenDotaMmr } from '@/lib/dota-rank';
import { persistOpenDotaRank } from '@/server/opendota-rank';
import { HeroProgressSection } from '@/components/profile/HeroProgressSection';
import { DotaSyncPanel } from '@/components/profile/DotaSyncPanel';
import { StaffTotpCard } from '@/components/profile/StaffTotpCard';
import { TwitchConnect } from '@/components/profile/TwitchConnect';
import { DotaPlusHowTo } from '@/components/heroes/DotaPlusHowTo';
import { ProfileDesk } from '@/components/profile/ProfileDesk';
import { ProfileOpenDotaDesk } from '@/components/profile/ProfileOpenDotaDesk';
import { getCurrentSteamUser } from '@/server/auth/session';
import { mergeOfficialHeroProgress } from '@/lib/hero-progress-display';
import { formatStoredArenaRating } from '@/lib/arena-rating';
import { canShowGuildBlock, formatGuildGcStat } from '@/lib/guild-snapshot';
import { formatMoscowDateTime, formatMoscowDay } from '@/lib/datetime';
import { championshipsForPlayer, loadChampionships } from '@/lib/champions';
import { CupTrophy } from '@/components/tournaments/CupTrophy';
import { HeroMedia } from '@/components/heroes/HeroMedia';

export const dynamic = 'force-dynamic';

const tileClass = 'rounded-xl border border-line bg-black/20 p-3';
const metricHints = {
	kda: 'KDA = (Убийства + Помощи) / max(Смерти, 1). Ориентир: 2+ хорошо, 3+ очень хорошо.',
	gpm: 'GPM (Gold Per Minute) - золото в минуту. Ориентир: 350-450 средне, 500+ сильно.',
	xpm: 'XPM (XP Per Minute) - опыт в минуту. Ориентир: 450-600 средне, 700+ сильно.',
	wr: 'Winrate = Победы / Матчи * 100%. Ориентир: 50% баланс, 55%+ очень хорошо.'
};

export default async function ProfilePage({ params }: { params: Promise<{ id: string }> }) {
	const { id } = await params;
	const sessionUser = await getCurrentSteamUser();
	if (!sessionUser) redirect('/');
	if (sessionUser.id !== id) redirect(`/profile/${sessionUser.id}`);

	const user = await syncSteamProfileIfNeeded(sessionUser);
	const [lastClientSnapshot, officialHeroCount, guildMembership] = await Promise.all([
		prisma.dotaClientSnapshot.findFirst({
			where: { userId: user.id },
			orderBy: { createdAt: 'desc' },
			select: { createdAt: true }
		}),
		prisma.dotaHeroProgress.count({ where: { userId: user.id } }),
		prisma.dotaGuildMember.findUnique({
			where: { userId: user.id },
			include: {
				guild: {
					include: {
						members: {
							orderBy: [{ points: 'desc' }, { displayName: 'asc' }],
							take: 50
						},
						snapshots: { orderBy: { capturedAt: 'desc' }, take: 1, select: { payload: true } }
					}
				}
			}
		})
	]);
	const championships = championshipsForPlayer(await loadChampionships().catch(() => []), user);
	const dota = await fetchDotaProfileAnalyticsBySteamId(user.steamId);
	if (dota && user.steamId) {
		const liveMmr = pickOpenDotaMmr({
			soloCompetitiveRank: dota.soloCompetitiveRank,
			competitiveRank: dota.competitiveRank,
			mmrEstimate: dota.mmrEstimate
		});
		if (dota.rankTier || liveMmr) {
			void persistOpenDotaRank(
				user.steamId,
				{ rankTier: dota.rankTier, leaderboardRank: dota.leaderboardRank },
				liveMmr
			).catch(() => undefined);
		}
	}
	const heroDisplay = await mergeOfficialHeroProgress(user.id, dota?.heroesProgress ?? []);
	const profileHeroes =
		heroDisplay.source === 'official'
			? [...heroDisplay.heroes].sort((a, b) => b.level - a.level || b.xp - a.xp).slice(0, 12)
			: heroDisplay.heroes;
	const showGuild = canShowGuildBlock({
		lastSyncedAt: guildMembership?.guild.lastSyncedAt,
		snapshotPayload: guildMembership?.guild.snapshots[0]?.payload
	});

	const medal = rankMedalFromTier(dota?.rankTier ?? user.openDotaRankTier ?? null, dota?.leaderboardRank ?? user.openDotaLeaderboard);
	const mmr =
		pickOpenDotaMmr({
			soloCompetitiveRank: dota?.soloCompetitiveRank,
			competitiveRank: dota?.competitiveRank,
			mmrEstimate: dota?.mmrEstimate
		}) ?? storedOpenDotaMmr(user.openDotaMmr, user.openDotaMmrSource);
	const trend = dota?.formTrend ?? [];
	const trendMin = trend.length ? Math.min(...trend.map((p) => p.cumulative)) : 0;
	const trendMax = trend.length ? Math.max(...trend.map((p) => p.cumulative)) : 0;
	const trendRange = Math.max(1, trendMax - trendMin);
	const chartW = 760;
	const chartH = 180;
	const chartPad = 18;
	const trendPath = trend
		.map((p, idx) => {
			const x = chartPad + (idx * (chartW - chartPad * 2)) / Math.max(1, trend.length - 1);
			const y = chartH - chartPad - ((p.cumulative - trendMin) / trendRange) * (chartH - chartPad * 2);
			return `${idx === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`;
		})
		.join(' ');

	const privacyNotes = dota ? (
		<>
			{dota.hasPrivateHistory && (
				<div className="rounded-xl border border-orange-700/70 bg-orange-950/30 p-3 text-sm text-orange-100">
					OpenDota сообщает, что история матчей скрыта. Блоки по матчам, ролям и героям не могут показать реальную статистику.
				</div>
			)}
			{!dota.hasPublicMatchData && !dota.hasPrivateHistory && (
				<div className="rounded-xl border border-yellow-700/60 bg-yellow-950/20 p-3 text-sm text-yellow-100">
					OpenDota не видит историю матчей. В клиенте Dota 2 включите «Expose Public Match Data» и сыграйте 1–2 матча.
				</div>
			)}
		</>
	) : null;

	return (
		<main className="mx-auto max-w-5xl px-6 py-8">
			<ProfileDesk
				identity={
					<div className="flex items-center gap-4">
						{user.avatarUrl && (
							<Image
								src={user.avatarUrl}
								alt={user.displayName}
								width={64}
								height={64}
								unoptimized
								className="h-16 w-16 rounded-full border border-line object-cover"
							/>
						)}
						<div className="min-w-0">
							<div className="flex flex-wrap items-center gap-2">
								<h1 className="font-display text-2xl text-cream">{user.displayName}</h1>
								{medal ? (
									<span className="inline-flex items-center gap-2 rounded-lg border border-line/70 bg-black/25 px-2 py-1">
										<RankMedal
											tier={medal.tier}
											stars={medal.stars}
											leaderboard={medal.leaderboard}
											size={28}
											showLabel={false}
										/>
										<span className="text-xs text-aegisSoft">
											{formatRankTier(dota?.rankTier ?? user.openDotaRankTier ?? null)}
											{mmr ? ` · ${formatOpenDotaMmr(mmr)}` : ''}
										</span>
									</span>
								) : null}
								{championships[0] && (
									<span className="inline-flex items-center gap-1 rounded-full border border-aegis/40 bg-aegis/15 px-2.5 py-0.5 text-xs font-semibold text-aegisSoft">
										чемпион {championships[0].year}
									</span>
								)}
								{dota?.isDotaPlus && (
									<span className="inline-flex items-center gap-1 rounded-full border border-emerald-400/40 bg-emerald-500/15 px-2.5 py-0.5 text-xs font-semibold text-emerald-200">
										<span className="text-emerald-300">+</span>
										Dota Plus
									</span>
								)}
								{dota && !dota.isDotaPlus && (
									<span className="rounded-full border border-line px-2.5 py-0.5 text-xs text-muted">Dota Plus: нет</span>
								)}
							</div>
							<div className="mt-1 text-sm text-muted">
								#{user.userId}
								{user.username ? ` @${user.username}` : ''}
							</div>
						</div>
					</div>
				}
				tiles={[
					{
						label: 'Визитка',
						value: 'как видят другие',
						hint: 'Публичные кубки и рейтинг арены, без кабинета',
						href: `/players/${user.id}`
					},
					{
						label: 'Рейтинг арены',
						value: formatStoredArenaRating(user.rating, user.ratingGames),
						hint: 'Только пары турнира, +16 / −12. Не медаль OpenDota и не Plus'
					},
					{
						label: 'Баланс',
						value: `${(user.balance / 100).toFixed(2)} ₽`,
						hint: 'Приз 70/30 приходит капитану 1 и 2 места',
						href: '/balance'
					},
					{
						label: 'Twitch',
						value: user.twitchChannel ? user.twitchChannel : 'не привязан',
						hint: user.twitchChannel ? 'Изменить канал' : 'Привязать эфир',
						panel: 'twitch'
					},
					{
						label: 'Plus',
						value: officialHeroCount > 0 ? `${officialHeroCount} героев` : 'нет снимка',
						hint: 'Уровни и helper',
						panel: 'plus'
					},
					...(championships[0]
						? [
								{
									label: 'Кубок',
									value: `${championships[0].year} · ${championships[0].engraving}`,
									hint: championships[0].title,
									href: championships[0].href
								}
							]
						: [])
				]}
				overview={
					<section className="obsidian-glass rounded-card space-y-4 p-5">
						{championships.length > 0 && (
							<div className="space-y-3" data-profile-cups="1">
								{championships.map((cup) => (
									<CupTrophy key={cup.tournamentId} trophy={cup.trophy} compact />
								))}
							</div>
						)}
						<div className="flex flex-wrap items-end justify-between gap-2">
							<div>
								<h2 className="font-display text-lg text-cream">Кратко</h2>
								<p className="mt-1 text-xs text-muted">Полные блоки — во вкладках сверху или правым кликом. Здесь только резюме.</p>
							</div>
							{dota && <span className="text-[11px] text-muted">{dota.source} • {formatMoscowDateTime(dota.fetchedAt)}</span>}
						</div>
						{!user.steamId && <div className={tileClass}>Steam аккаунт не привязан.</div>}
						{user.steamId && !dota && (
							<div className="space-y-3">
								{medal ? (
									<div className={tileClass}>
										<div className="text-[10px] uppercase tracking-wide text-muted">Медаль OpenDota (кэш)</div>
										<div className="mt-2 flex items-center gap-2">
											<RankMedal tier={medal.tier} stars={medal.stars} leaderboard={medal.leaderboard} size={32} />
											<span className="text-sm text-cream">
												{formatRankTier(user.openDotaRankTier ?? null)}
												{mmr ? ` · ${formatOpenDotaMmr(mmr)}` : ''}
											</span>
										</div>
									</div>
								) : (
									<div className={tileClass}>Статистика временно недоступна или профиль в Dota закрыт.</div>
								)}
							</div>
						)}
						{dota && (
							<>
								<div className="grid grid-cols-2 gap-3 md:grid-cols-4">
									<div className={tileClass}>
										<div className="text-[10px] uppercase tracking-wide text-muted">Медаль OpenDota</div>
										<div className="mt-2 flex items-center gap-2">
											{medal ? <RankMedal tier={medal.tier} stars={medal.stars} leaderboard={dota.leaderboardRank ?? undefined} size={32} /> : null}
											<span className="text-sm text-cream">{formatRankTier(dota.rankTier)}</span>
										</div>
									</div>
									<div className={tileClass}>
										<div className="text-[10px] uppercase tracking-wide text-muted">Winrate</div>
										<div className="mt-1 text-sm text-cream">{dota.winRate !== null ? `${dota.winRate}%` : '—'}</div>
										<div className="text-[11px] text-muted">{dota.win ?? 0} / {dota.lose ?? 0}</div>
									</div>
									<div className={tileClass}>
										<div className="text-[10px] uppercase tracking-wide text-muted">KDA</div>
										<div className="mt-1 text-sm text-cream">{dota.averages?.kda ?? '—'}</div>
										<div className="text-[11px] text-muted">GPM {dota.averages?.gpm ?? '—'} • XPM {dota.averages?.xpm ?? '—'}</div>
									</div>
									<div className={tileClass}>
										<div className="text-[10px] uppercase tracking-wide text-muted">Форма</div>
										<div className="mt-1 text-sm text-cream">
											{trend.length ? `${trend[trend.length - 1].cumulative > 0 ? '+' : ''}${trend[trend.length - 1].cumulative}` : 'нет данных'}
										</div>
										<div className="text-[11px] text-muted">20 последних матчей</div>
									</div>
								</div>
								{privacyNotes}
								<div>
									<div className="mb-2 text-sm text-cream">Топ героев</div>
									{dota.topHeroes.length === 0 ? (
										<div className={`${tileClass} text-sm text-muted`}>Пока нет истории игр по героям.</div>
									) : (
										<div className="grid grid-cols-2 gap-2 md:grid-cols-3">
											{dota.topHeroes.slice(0, 6).map((h) => (
												<div key={h.heroId} className="flex items-center gap-2 rounded-xl border border-line bg-black/20 px-2 py-2">
													{h.heroImage ? (
														<HeroMedia src={h.heroImage} alt={h.heroName} width={56} height={32} className="h-8 w-14 rounded object-cover" />
													) : (
														<div className="h-8 w-14 rounded bg-panel" />
													)}
													<div className="min-w-0">
														<div className="truncate text-sm text-cream">{h.heroName}</div>
														<div className="text-[11px] text-muted">{h.games} • {h.winRate}%</div>
													</div>
												</div>
											))}
										</div>
									)}
								</div>
							</>
						)}
					</section>
				}
				plus={
					<div className="space-y-4">
						<DotaPlusHowTo loggedIn defaultOpen profileHref={`/profile/${user.id}`} />
						<DotaSyncPanel
							lastSyncedAt={lastClientSnapshot?.createdAt.toISOString() ?? null}
							officialHeroCount={officialHeroCount}
						/>
						<StaffTotpCard />
					</div>
				}
				twitch={<TwitchConnect initialChannel={user.twitchChannel} />}
				opendota={
					!user.steamId ? (
						<section className="obsidian-glass rounded-card p-5 text-sm text-muted">Steam аккаунт не привязан.</section>
					) : !dota ? (
						<section className="obsidian-glass rounded-card p-5 text-sm text-muted">Статистика временно недоступна или профиль в Dota закрыт.</section>
					) : (
						<ProfileOpenDotaDesk
							sourceLabel={`${dota.source} • ${formatMoscowDateTime(dota.fetchedAt)}`}
							summary={
								<div className="space-y-4">
									{privacyNotes}
									<div className="grid grid-cols-2 gap-3 md:grid-cols-3">
										<div className={tileClass}>Dota ID: {dota.accountId}</div>
										<div className={tileClass}>
											<div className="mb-2">Ранг: {formatRankTier(dota.rankTier)}</div>
											{medal ? (
												<RankMedal tier={medal.tier} stars={medal.stars} leaderboard={dota.leaderboardRank ?? undefined} size={38} />
											) : (
												<span className="text-sm text-muted">Медаль недоступна</span>
											)}
										</div>
										<div className={tileClass} title="Число с OpenDota, не рейтинг арены">
											{mmr ? formatOpenDotaMmr(mmr) : 'OpenDota не отдал MMR'}
										</div>
										<div className={tileClass}>Победы: {dota.win ?? 0}</div>
										<div className={tileClass}>Поражения: {dota.lose ?? 0}</div>
										<div className={tileClass} title={metricHints.wr}>
											Winrate: {dota.winRate !== null ? `${dota.winRate}%` : 'Не определён'}
										</div>
										<div className={tileClass}>Лидерборд: {dota.leaderboardRank ?? 'Не определён'}</div>
										<div className={tileClass}>Solo MMR: {dota.soloCompetitiveRank ?? 'Не определён'}</div>
										<div className={tileClass}>Party/Comp MMR: {dota.competitiveRank ?? 'Не определён'}</div>
									</div>
									{dota.averages && (
										<div className="grid grid-cols-2 gap-2 md:grid-cols-6">
											<div className={tileClass}>K: {dota.averages.kills}</div>
											<div className={tileClass}>D: {dota.averages.deaths}</div>
											<div className={tileClass}>A: {dota.averages.assists}</div>
											<div className={tileClass} title={metricHints.kda}>KDA: {dota.averages.kda}</div>
											<div className={tileClass} title={metricHints.gpm}>GPM: {dota.averages.gpm}</div>
											<div className={tileClass} title={metricHints.xpm}>XPM: {dota.averages.xpm}</div>
										</div>
									)}
								</div>
							}
							heroes={
								<div className="space-y-5">
									<div>
										<h3 className="mb-3 text-sm font-semibold text-cream">Топ-герои</h3>
										{dota.topHeroes.length === 0 && <div className={`${tileClass} text-sm text-muted`}>Пока нет истории игр по героям.</div>}
										{dota.topHeroes.length > 0 && (
											<div className="grid grid-cols-1 gap-2 md:grid-cols-2">
												{dota.topHeroes.map((h) => (
													<div key={h.heroId} className="flex items-center gap-3 rounded-xl border border-line bg-black/20 p-3">
														{h.heroImage ? (
															<HeroMedia src={h.heroImage} alt={h.heroName} width={56} height={32} className="h-8 w-14 rounded object-cover" />
														) : (
															<div className="h-8 w-14 rounded bg-panel" />
														)}
														<div className="text-sm">
															<div className="font-medium text-cream">{h.heroName}</div>
															<div className="text-muted" title={metricHints.wr}>{h.games} игр • WR {h.winRate}%</div>
														</div>
													</div>
												))}
											</div>
										)}
									</div>
									<HeroProgressSection heroes={profileHeroes} source={heroDisplay.source} />
								</div>
							}
							form={
								<div className="space-y-6">
									<section>
										<h3 className="mb-2 text-sm font-semibold text-cream">График формы (20 последних матчей)</h3>
										<p className="mb-3 text-xs text-muted">Победа поднимает линию, поражение опускает.</p>
										{trend.length < 2 && <div className={`${tileClass} text-sm text-muted`}>Недостаточно данных для графика формы.</div>}
										{trend.length >= 2 && (
											<div className={tileClass}>
												<svg viewBox={`0 0 ${chartW} ${chartH}`} className="h-44 w-full">
													<line x1={chartPad} y1={chartH / 2} x2={chartW - chartPad} y2={chartH / 2} stroke="rgba(148,163,184,0.35)" strokeDasharray="4 4" />
													<path d={trendPath} fill="none" stroke="rgba(242,207,123,0.95)" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
													{trend.map((p, idx) => {
														const x = chartPad + (idx * (chartW - chartPad * 2)) / Math.max(1, trend.length - 1);
														const y = chartH - chartPad - ((p.cumulative - trendMin) / trendRange) * (chartH - chartPad * 2);
														return (
															<circle key={p.matchId} cx={x} cy={y} r={3.5} fill={p.didWin ? '#4ade80' : '#f87171'}>
																<title>{`${p.didWin ? 'Победа' : 'Поражение'} • ${p.dateLabel} • форма: ${p.cumulative > 0 ? '+' : ''}${p.cumulative}`}</title>
															</circle>
														);
													})}
												</svg>
												<div className="mt-2 flex flex-wrap gap-4 text-xs text-muted">
													<span>Старт: {trend[0].dateLabel}</span>
													<span>Финиш: {trend[trend.length - 1].dateLabel}</span>
													<span>Текущая форма: {trend[trend.length - 1].cumulative > 0 ? '+' : ''}{trend[trend.length - 1].cumulative}</span>
												</div>
											</div>
										)}
									</section>
									<section>
										<h3 className="mb-2 text-sm font-semibold text-cream">Любимые роли</h3>
										{dota.favoriteRoles.length === 0 && <div className={`${tileClass} text-sm text-muted`}>Недостаточно данных по ролям.</div>}
										<div className="space-y-2">
											{dota.favoriteRoles.map((role) => (
												<div key={role.role} className={tileClass}>
													<div className="mb-2 flex items-center justify-between text-sm">
														<div className="font-medium text-cream">{role.role}</div>
														<div className="text-muted">{role.games} • {role.pickRate}% • WR {role.winRate}%</div>
													</div>
													<div className="h-2 overflow-hidden rounded-full border border-line bg-panel">
														<div className="h-full bg-gradient-to-r from-sky-500/80 to-aegis/80" style={{ width: `${role.pickRate}%` }} />
													</div>
												</div>
											))}
										</div>
									</section>
									<section>
										<h3 className="mb-2 text-sm font-semibold text-cream">Winrate по ролям и патчам</h3>
										<div className="grid grid-cols-1 gap-2 md:grid-cols-2">
											{dota.roleWinrates.map((r) => (
												<div key={r.label} className={tileClass}>
													<div className="font-medium text-cream">{r.label}</div>
													<div className="text-sm text-muted">{r.games} игр • WR {r.winRate}%</div>
												</div>
											))}
											{dota.patchWinrates.map((p) => (
												<div key={p.label} className={tileClass}>
													<div className="font-medium text-cream">{p.label}</div>
													<div className="text-sm text-muted">{p.games} игр • WR {p.winRate}%</div>
												</div>
											))}
										</div>
									</section>
								</div>
							}
							matches={
								<div className="space-y-2">
									<p className="text-xs text-muted">Герой, роль, патч, K/D/A, GPM/XPM и итог по последним публичным матчам.</p>
									{dota.recentMatches.length === 0 && <div className={`${tileClass} text-sm text-muted`}>OpenDota пока не отдала список последних матчей.</div>}
									{dota.recentMatches.map((m) => (
										<div key={m.matchId} className="flex flex-col gap-2 rounded-xl border border-line bg-black/20 p-3 md:flex-row md:items-center md:justify-between">
											<div className="flex items-center gap-3">
												{m.heroImage ? (
													<HeroMedia src={m.heroImage} alt={m.heroName} width={64} height={36} className="h-9 w-16 rounded object-cover" />
												) : (
													<div className="h-9 w-16 rounded bg-panel" />
												)}
												<div>
													<div className="text-sm font-medium text-cream">{m.heroName}</div>
													<div className="text-xs text-muted">
														{m.role} • {m.patchLabel} • {formatMoscowDay(m.startedAt)}
													</div>
												</div>
											</div>
											<div className="text-sm text-cream" title={metricHints.kda}>
												{m.kills}/{m.deaths}/{m.assists}
											</div>
											<div className="text-sm text-muted">
												{m.gpm} / {m.xpm} • {m.durationMinutes} мин
											</div>
											<div className={`text-sm font-semibold ${m.didWin ? 'text-green-400' : 'text-red-400'}`}>
												{m.didWin ? 'Выиграл' : 'Проиграл'}
											</div>
										</div>
									))}
								</div>
							}
						/>
					)
				}
				guild={
					showGuild && guildMembership ? (
						<section className="obsidian-glass rounded-card space-y-3 p-5">
							<div>
								<h2 className="font-display text-lg text-cream">Гильдия Dota 2</h2>
								<p className="mt-1 text-xs text-muted">Очки и место — только из ответа координатора. Это не рейтинг арены и не Plus.</p>
							</div>
							<div className="grid grid-cols-1 gap-3 md:grid-cols-4">
								<div className={`${tileClass} md:col-span-2`}>
									<div className="text-[10px] uppercase tracking-wide text-muted">Гильдия</div>
									<div className="mt-1 text-lg font-semibold text-cream">
										{guildMembership.guild.name}
										{guildMembership.guild.tag ? ` [${guildMembership.guild.tag}]` : ''}
									</div>
								</div>
								<div className={tileClass}>
									<div className="text-[10px] uppercase tracking-wide text-muted">Очки</div>
									<div className="mt-1 text-lg font-semibold text-aegis">{formatGuildGcStat(guildMembership.guild.points)}</div>
								</div>
								<div className={tileClass}>
									<div className="text-[10px] uppercase tracking-wide text-muted">Место</div>
									<div className="mt-1 text-lg font-semibold text-cream">
										{guildMembership.guild.leaderboardRank ? `#${guildMembership.guild.leaderboardRank}` : 'Нет данных'}
									</div>
								</div>
							</div>
							<div className={tileClass}>
								<div className="mb-3 flex flex-wrap items-center justify-between gap-2">
									<h3 className="font-semibold text-cream">Состав</h3>
									<span className="text-xs text-muted">
										Уровень: {guildMembership.guild.level ?? 'Нет данных'} • {formatMoscowDateTime(guildMembership.guild.lastSyncedAt)}
									</span>
								</div>
								<div className="space-y-2">
									{guildMembership.guild.members.map((member) => (
										<div key={member.id} className="flex flex-wrap items-center justify-between gap-2 border-t border-line pt-2 text-sm">
											<span className="font-medium text-cream">{member.displayName ?? `Steam ${member.steamId.slice(-5)}`}</span>
											<span className="text-muted">{member.role ?? 'Участник'} • Очки: {member.points ?? 'Нет данных'}</span>
										</div>
									))}
								</div>
							</div>
						</section>
					) : undefined
				}
			/>
		</main>
	);
}
