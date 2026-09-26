'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { HomeArenaPlayer, HomeArenaPulse, HomeLiveCard, HomeOpenCup, HomeTeamCard, RosterGap } from '@/lib/home-live';
import {
	EMPTY_ARENA_PULSE,
	homeCupHint,
	homeOpenCupHint,
	homeStepAction,
	liveHomePairCount,
	ownOpenHomePairs,
	pickNearestHomeCup,
	pickPrimaryHomeStep,
	resolveHomeTeamCard
} from '@/lib/home-live';
import { matchDayHref } from '@/lib/match-day';
import { partySearchHref } from '@/lib/team-roster';
import { teamDeskHref } from '@/lib/site';
import { TeamRosterSlots } from '@/components/teams/TeamRosterSlots';
import { SteamAvatar } from '@/components/desk/SteamAvatar';
import { PartyPanel, type InviteTarget } from '@/components/players/PartyPanel';
import { twitchPlayerSrc } from '@/lib/twitch';
import { MatchRecapCard } from '@/components/tournaments/MatchRecapCard';
import { PlusReplaySyncButton } from '@/components/heroes/PlusReplaySyncButton';
import { StaffDisputeInbox, type StaffInboxRow } from '@/components/home/StaffDisputeInbox';
import { StaffAttentionInbox } from '@/components/home/StaffAttentionInbox';
import type { AdminAttention } from '@/lib/admin-desk';
import { DeskMenu, bindDeskMenuClose, clampMenu } from '@/components/desk/DeskMenu';
import { MatchDayNextStep } from '@/components/match-day/MatchDayNextStep';
import { CopyLobbyButton } from '@/components/desk/CopyLobby';
import { StickyActionBar } from '@/components/ui/StickyActionBar';
import { LiveCountdown } from '@/components/ui/LiveCountdown';
import { useHomeLive } from '@/components/home/useHomeLive';
import { LobbyChat } from '@/components/home/LobbyChat';
import { PullToRefresh } from '@/components/ui/PullToRefresh';
import { Clock3, MoreHorizontal } from 'lucide-react';

type LiveStream = {
	login: string;
	title: string;
	viewerCount: number;
};

type PanelId = 'pairs' | 'streams' | 'plus' | 'disputes';

function formatRemain(ms: number) {
	const total = Math.max(0, Math.floor(ms / 1000));
	const days = Math.floor(total / 86400);
	const hours = Math.floor((total % 86400) / 3600);
	const minutes = Math.floor((total % 3600) / 60);
	const seconds = total % 60;
	if (days > 0) return `${days}д ${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
	return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

function Countdown({ iso, ended = 'Матч начался' }: { iso: string; ended?: string }) {
	const [now, setNow] = useState<number | null>(null);
	useEffect(() => {
		setNow(Date.now());
		const timer = window.setInterval(() => setNow(Date.now()), 1000);
		return () => window.clearInterval(timer);
	}, []);
	if (now === null) return <span className="font-mono text-aegisSoft">—:—:—</span>;
	const left = Date.parse(iso) - now;
	if (Number.isNaN(left) || left <= 0) return <span className="text-xs font-semibold uppercase tracking-wide text-[#5EE7F2]">{ended}</span>;
	return <div className="font-mono text-sm text-cream">{formatRemain(left)}</div>;
}

function PrimaryTiming({ card }: { card: HomeLiveCard }) {
	if (['done', 'recap', 'browse'].includes(card.action.code)) return null;
	const timing = card.reportDeadlineLabel
		? { label: 'Сдать счёт до', value: card.reportDeadlineLabel, iso: null as string | null, ended: '' }
		: card.action.code === 'check_in' && card.checkInClosesAt
			? { label: 'Отметить состав до', value: card.checkInClosesLabel ?? '', iso: card.checkInClosesAt, ended: 'Окно закрылось' }
			: { label: 'Старт', value: card.startLabel, iso: card.startAt, ended: 'Турнир начался' };

	return (
		<div className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 rounded-lg border border-aegis/35 bg-aegis/5 px-3 py-3">
			<Clock3 className="h-5 w-5 text-aegisSoft" aria-hidden="true" />
			<div className="min-w-0">
				<p className="text-[10px] uppercase tracking-[0.14em] text-muted">{timing.label}</p>
				<p className="truncate text-sm font-semibold text-cream">{timing.value}</p>
			</div>
			{timing.iso ? <LiveCountdown iso={timing.iso} ended={timing.ended} size="sm" /> : null}
		</div>
	);
}

function nowCopy(
	primary: ReturnType<typeof pickPrimaryHomeStep>,
	hasTeam: boolean
): { kicker: string; title: string; hint: string } {
	if (primary?.kind === 'apply') {
		return {
			kicker: 'Сейчас',
			title: 'Заявить пятёрку',
			hint: `«${primary.gap.teamName}» собрана 5/5 Steam. Капитан заявляет её на ${primary.gap.tournamentTitle ?? 'открытый кубок'} — это заявка в сетку, не поиск пати.`
		};
	}
	if (primary?.kind === 'roster') {
		return {
			kicker: 'Сейчас',
			title: 'Добрать состав',
			hint: `В «${primary.gap.teamName}» Steam ${primary.gap.withSteam} из 5. Ещё ${primary.gap.needed} со Steam — иначе кубок заявку не примет.`
		};
	}
	if (primary?.kind === 'card') {
		const action = homeStepAction(primary.card);
		return {
			kicker: 'Сейчас',
			title: action.label,
			hint: action.hint
		};
	}
	if (hasTeam) {
		return {
			kicker: 'Сейчас',
			title: 'Нет открытой пары',
			hint: 'Пятёрка есть. Заявите её на кубок или дождитесь check-in / дня матча — следующий шаг появится здесь.'
		};
	}
	return {
		kicker: 'С чего начать',
		title: 'Соберите пятёрку',
		hint: 'Сначала пять игроков со Steam, потом кубок. Рейтинг арены появится только после закрытой пары, не после входа.'
	};
}

function SteamDots({ have }: { have: number }) {
	const filled = Math.max(0, Math.min(5, have));
	return (
		<div className="mt-2 flex gap-1" aria-hidden>
			{[0, 1, 2, 3, 4].map((slot) => (
				<span key={slot} className={`h-1.5 flex-1 rounded-full ${slot < filled ? 'bg-aegis' : 'bg-line'}`} />
			))}
		</div>
	);
}

function PlaySeal({ href, label }: { href: string; label: string }) {
	return (
		<a href={href} data-home-play="true" className="home-play-seal aegis-action" aria-label={`ИГРАТЬ. ${label}`}>
			{/* Black plate in the source art drops out with screen blend. */}
			{/* eslint-disable-next-line @next/next/no-img-element */}
			<img src="/aegis-champions-mark.png" alt="" width={360} height={353} className="home-play-aegis" />
			<span className="home-play-seal-word">ИГРАТЬ</span>
			<span className="home-play-seal-hint">{label}</span>
		</a>
	);
}

function PlaceCard({
	href,
	kicker,
	title,
	hint,
	meter
}: {
	href: string;
	kicker: string;
	title: string;
	hint: string;
	meter?: number;
}) {
	return (
		<a href={href} className="obsidian-glass rounded-card block p-3.5 hover:border-aegis/40">
			<p className="text-[10px] uppercase tracking-[0.14em] text-muted">{kicker}</p>
			<p className="mt-1 truncate font-display text-base text-cream">{title}</p>
			<p className="mt-1 text-xs leading-5 text-muted">{hint}</p>
			{meter != null && <SteamDots have={meter} />}
		</a>
	);
}

function livePairsLabel(count: number) {
	const word =
		count % 10 === 1 && count % 100 !== 11
			? 'пара'
			: count % 10 >= 2 && count % 10 <= 4 && (count % 100 < 10 || count % 100 >= 20)
				? 'пары'
				: 'пар';
	return `${count === 1 ? 'идёт' : 'идут'} ${count} ${word}`;
}

function ApplyReadyCard({ gap }: { gap: RosterGap }) {
	const router = useRouter();
	const [busy, setBusy] = useState(false);
	const [error, setError] = useState<string | null>(null);

	async function apply() {
		if (!gap.tournamentId) {
			router.push('/tournaments');
			return;
		}
		setBusy(true);
		setError(null);
		const res = await fetch(`/api/tournaments/${gap.tournamentId}/register`, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ teamId: gap.teamId })
		});
		const data = await res.json().catch(() => null);
		setBusy(false);
		if (!res.ok) {
			setError(data?.error ?? 'Не удалось заявить команду.');
			return;
		}
		router.push(`/tournaments/${gap.tournamentId}`);
	}

	return (
		<article id="primary-action" className="mobile-urgent-card mobile-enter scroll-mt-20 space-y-3 p-5">
			<div className="text-xs uppercase tracking-[0.18em] text-[#FF8A5C]">Сейчас</div>
			<h1 className="font-display text-2xl text-cream md:text-3xl">Заявить пятёрку</h1>
			<p className="text-sm text-muted">
				«{gap.teamName}» собрана 5/5 Steam. Капитан заявляет её на {gap.tournamentTitle ?? 'открытый кубок'}.
			</p>
			<div className="flex flex-wrap gap-2">
				<button
					type="button"
					disabled={busy || !gap.tournamentId}
					onClick={() => void apply()}
					className="inline-flex min-h-12 items-center rounded-lg border border-aegis/50 bg-aegis/10 px-4 py-2 text-sm font-semibold text-aegisSoft hover:border-aegis disabled:opacity-50"
				>
					{busy ? 'Заявляем…' : gap.tournamentTitle ? `Заявить на ${gap.tournamentTitle}` : 'Заявить команду'}
				</button>
				{gap.tournamentId && (
					<a href={`/tournaments/${gap.tournamentId}`} className="inline-flex min-h-12 items-center rounded-lg border border-line px-4 py-2 text-sm text-muted hover:text-cream">
						Открыть карточку
					</a>
				)}
			</div>
			{error && <p className="text-xs text-dire">{error}</p>}
		</article>
	);
}

function MatchWindow({ card, streams }: { card: HomeLiveCard; streams: LiveStream[] }) {
	const [now, setNow] = useState<number | null>(null);
	useEffect(() => {
		setNow(Date.now());
		const timer = window.setInterval(() => setNow(Date.now()), 1000);
		return () => window.clearInterval(timer);
	}, []);
	const started = now !== null && Date.parse(card.startAt) <= now;
	const liveStream = card.channels.map((login) => streams.find((stream) => stream.login === login)).find(Boolean) ?? null;
	const channel = liveStream?.login ?? card.channels[0] ?? null;
	const showVideo = Boolean(channel && (liveStream || started || card.tournamentStatus === 'LIVE' || card.matchStatus === 'LIVE'));
	const playing = Boolean(liveStream) || (started && (card.matchStatus === 'LIVE' || card.tournamentStatus === 'LIVE' || card.scoreA + card.scoreB > 0));
	const parent = typeof window !== 'undefined' ? window.location.hostname : 'localhost';

	return (
		<article className="min-w-0 overflow-hidden rounded-card obsidian-glass">
			<div className="relative aspect-video bg-[#120818]">
				{showVideo && channel ? (
					<iframe
						title={`Эфир ${card.title}`}
						src={twitchPlayerSrc(channel, parent)}
						className="absolute inset-0 h-full w-full"
						allow="autoplay; encrypted-media; picture-in-picture"
						allowFullScreen
					/>
				) : (
					<a href={card.href} className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-[radial-gradient(circle_at_50%_20%,rgba(124,62,196,0.28),transparent_46%)]">
						<div className="text-[10px] uppercase tracking-[0.2em] text-muted">{channel ? 'Эфир ещё не начался' : 'Канал эфира не указан'}</div>
						<Countdown iso={card.startAt} />
					</a>
				)}
				<div className="pointer-events-none absolute left-2 top-2 rounded-full border border-white/10 bg-ink/70 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide">
					{playing || liveStream ? <span className="text-red-300">● Live</span> : <span className="text-[#F5D76E]">Ожидание</span>}
				</div>
				{liveStream && (
					<div className="pointer-events-none absolute right-2 top-2 rounded-full bg-ink/70 px-2 py-0.5 text-[10px] text-cream">
						{liveStream.viewerCount} зрителей
					</div>
				)}
				<div className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-ink via-ink/70 to-transparent px-3 pb-2 pt-8">
					<div className="flex items-end justify-between gap-2">
						<div className="min-w-0 text-[11px] leading-4 text-cream">
							<div className="truncate font-semibold">{card.teamA?.name ?? card.teamName}</div>
							<div className="truncate text-muted">{card.teamB?.name ?? 'Соперник ещё не известен'}</div>
						</div>
						<div className="font-display text-2xl tabular-nums text-cream">
							{card.scoreA}:{card.scoreB}
						</div>
					</div>
				</div>
			</div>
			<a href={card.href} className="block space-y-1 p-3 hover:bg-aegis/5">
				<div className="truncate font-display text-sm text-cream">{card.title}</div>
				<div className="flex items-center justify-between gap-2 text-[11px] text-muted">
					<span>BO{card.bestOf}</span>
					<span className="text-aegisSoft">{card.action.label}</span>
				</div>
			</a>
		</article>
	);
}

export function HomeDesk({
	cards: initial,
	rosterGaps: initialGaps = [],
	officialHeroCount,
	disputes,
	attention = [],
	userId,
	displayName,
	myTeam: initialTeam = null,
	nearestOpenCup: initialCup = null,
	arenaOnline: initialOnline = [],
	pulse: initialPulse = EMPTY_ARENA_PULSE
}: {
	cards: HomeLiveCard[];
	rosterGaps?: RosterGap[];
	officialHeroCount: number;
	disputes: StaffInboxRow[];
	attention?: AdminAttention[];
	userId?: string | null;
	displayName?: string | null;
	myTeam?: HomeTeamCard | null;
	nearestOpenCup?: HomeOpenCup | null;
	arenaOnline?: HomeArenaPlayer[];
	pulse?: HomeArenaPulse;
}) {
	const { cards, rosterGaps, myTeam, nearestOpenCup, arenaOnline, pulse, liveState, refresh } = useHomeLive(
		initial,
		initialGaps,
		initialTeam,
		initialCup,
		initialOnline,
		initialPulse
	);
	const [streams, setStreams] = useState<LiveStream[]>([]);
	const [panel, setPanel] = useState<PanelId>('pairs');
	const [staffFilter, setStaffFilter] = useState<'all' | 'attention' | 'disputes'>('all');
	const [openId, setOpenId] = useState<string | null>(null);
	const [menu, setMenu] = useState<{ x: number; y: number; card?: HomeLiveCard } | null>(null);
	const [inviteTarget, setInviteTarget] = useState<InviteTarget | null>(null);

	const logins = useMemo(() => [...new Set(cards.flatMap((card) => card.channels))], [cards]);
	const loginKey = logins.join(',');
	const liveCount = liveHomePairCount(cards);
	const primary = pickPrimaryHomeStep(cards, rosterGaps);
	const primaryAction = primary?.kind === 'card' ? homeStepAction(primary.card) : null;
	const secondaryCards = ownOpenHomePairs(cards, primary?.kind === 'card' ? primary.card.id : null);
	const primaryCta =
		primary?.kind === 'apply'
			? {
					href: '#primary-action',
					label: 'Заявить пятёрку'
				}
			: primary?.kind === 'roster'
				? { href: partySearchHref({ teamId: primary.gap.teamId, tournamentId: primary.gap.tournamentId }), label: 'Пригласить игрока' }
				: primary?.kind === 'card' && primaryAction
					? {
							href:
								primaryAction.code === 'watch' && primary.card.matchId
									? `${primary.card.href}#match-${primary.card.matchId}`
									: matchDayHref(primary.card.href, primaryAction.code, primary.card.matchId),
							label: primaryAction.label
						}
					: { href: '/tournaments', label: 'Открыть турниры' };
	const copy = nowCopy(primary, Boolean(resolveHomeTeamCard(myTeam)));
	const teamCard = resolveHomeTeamCard(myTeam);
	const nearest = pickNearestHomeCup(cards, nearestOpenCup);
	const cupHref = nearest?.kind === 'card' ? nearest.card.href : nearest?.cup.href ?? '/tournaments';
	const cupTitle = nearest?.kind === 'card' ? nearest.card.title : nearest?.cup.title ?? 'Каталог турниров';
	const cupHint = nearest?.kind === 'card' ? homeCupHint(nearest.card) : nearest ? homeOpenCupHint(nearest.cup) : 'Открытые кубки. Приз — только если фонд на эскроу.';
	const cupTournamentId = nearest?.kind === 'card' ? nearest.card.tournamentId : nearest?.cup.id ?? null;
	const emptyCta =
		teamCard && !primary
			? { href: '/tournaments', label: 'Каталог кубков' }
			: primaryCta;

	useEffect(() => {
		let cancelled = false;
		async function pullStreams() {
			if (!loginKey) return;
			try {
				const res = await fetch(`/api/twitch/live?logins=${encodeURIComponent(loginKey)}`, { cache: 'no-store' });
				if (!res.ok || cancelled) return;
				const data = await res.json();
				if (Array.isArray(data.streams)) {
					setStreams(
						data.streams.map((stream: LiveStream) => ({
							login: stream.login,
							title: stream.title,
							viewerCount: stream.viewerCount
						}))
					);
				}
			} catch {
				// эфир Twitch не обязан быть доступен
			}
		}
		void pullStreams();
		const live = window.setInterval(pullStreams, 20000);
		return () => {
			cancelled = true;
			window.clearInterval(live);
		};
	}, [loginKey]);

	useEffect(() => {
		if (!menu) return;
		return bindDeskMenuClose(() => setMenu(null), '#home-desk-menu, [aria-label="Действия главной"], [aria-label="Действия пары"]');
	}, [menu]);

	function openHeaderMenu(x: number, y: number) {
		setMenu({ ...clampMenu(x, y), card: undefined });
	}

	function openCardMenu(card: HomeLiveCard, x: number, y: number) {
		setMenu({ ...clampMenu(x, y), card });
	}

	const headerItems = [
		{ id: 'pairs', label: `Пары (${cards.length})`, hint: 'Счёт, лобби, следующий шаг', onSelect: () => { setPanel('pairs'); setMenu(null); } },
		{ id: 'streams', label: 'Эфир', hint: 'Окно Twitch, если канал указан', onSelect: () => { setPanel('streams'); setMenu(null); } },
		{ id: 'plus', label: 'Plus', hint: 'Подтянуть официальный XP', onSelect: () => { setPanel('plus'); setMenu(null); } },
		...(disputes.length || attention.length
			? [{ id: 'disputes', label: `Штаб (${disputes.length + attention.length})`, hint: 'Споры и срочные дела', onSelect: () => { setPanel('disputes'); setMenu(null); } }]
			: []),
		{ id: 'tournaments', label: 'Турниры', hint: 'Каталог кубков', href: '/tournaments' },
		{ id: 'party', label: 'Собрать пятёрку', hint: 'Поиск игроков со Steam', href: '/party-search?tab=players' },
		...(userId ? [{ id: 'card', label: 'Моя визитка', hint: 'Как видят другие', href: `/players/${userId}` }] : []),
		{ id: 'heroes', label: 'Герои', hint: 'Каталог и бейджи Plus', href: '/heroes' }
	];

	return (
		<PullToRefresh onRefresh={refresh} label="Обновить главную" className="flex min-h-[calc(100dvh-6rem)] flex-1 flex-col">
		<div
			className="flex min-h-0 flex-1 flex-col"
			data-home-desk="true"
			data-home-live={liveState}
			onContextMenu={(event) => {
				const node = event.target as HTMLElement | null;
				if (node?.closest('input,textarea,a,button,article,[data-lobby-chat]')) return;
				event.preventDefault();
				openHeaderMenu(event.clientX, event.clientY);
			}}
		>
			<PartyPanel
				currentUserId={userId ?? null}
				teamId={teamCard?.id ?? ''}
				target={inviteTarget}
				chrome={false}
				onTargetClose={() => setInviteTarget(null)}
				onJoined={() => {
					void refresh();
				}}
				onRemoved={() => {
					void refresh();
				}}
				onParty={() => {
					void refresh();
				}}
			/>
			<div data-home-body={panel} className="flex min-h-0 min-w-0 flex-1 flex-col">
			{panel === 'pairs' && (
				<section className="flex min-h-0 flex-1 flex-col">
					<div className="grid min-h-0 flex-1 items-stretch gap-4 lg:grid-cols-[18.5rem_minmax(0,1fr)]">
					<div className="flex flex-col gap-3 self-start">
					<aside className="obsidian-glass space-y-4 rounded-card p-3.5" data-home-rail>
						<div className="flex items-center justify-between gap-3">
							<div className="min-w-0">
								<p className="truncate text-[10px] uppercase tracking-[0.14em] text-aegisSoft">{displayName ? `Игрок · ${displayName}` : 'Ваш стол'}</p>
								<p className="mt-1 text-xs text-muted">
									{teamCard?.roleLabel ? `${teamCard.roleLabel} · ` : ''}
									{liveCount > 0 ? `сейчас ${livePairsLabel(liveCount)}` : 'живых пар нет'}
								</p>
							</div>
							<button
								type="button"
								data-home-more="true"
								aria-label="Действия главной"
								onClick={(event) => {
									const rect = event.currentTarget.getBoundingClientRect();
									openHeaderMenu(rect.right - 240, rect.bottom + 6);
								}}
								className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-line text-muted hover:border-aegis/50 hover:text-cream"
							>
								<MoreHorizontal className="h-5 w-5" aria-hidden="true" />
							</button>
						</div>
						<div data-home-roster className="space-y-3">
							{teamCard ? (
								<a href={teamDeskHref(teamCard.id)} className="block hover:text-aegisSoft">
									<p className="text-[10px] uppercase tracking-[0.14em] text-muted">Пятёрка</p>
									<p className="mt-1 truncate font-display text-base text-cream">{teamCard.name}</p>
									<p className="mt-1 text-xs text-muted">
										{teamCard.needed > 0 ? `Steam ${teamCard.withSteam} из 5 · не хватает ${teamCard.needed}` : 'Состав 5 из 5 Steam'}
									</p>
								</a>
							) : (
								<div>
									<p className="text-[10px] uppercase tracking-[0.14em] text-muted">Пятёрка</p>
									<p className="mt-1 font-display text-base text-cream">Dota Party</p>
									<p className="mt-1 text-xs text-muted">Пять игроков со Steam. Пустой слот ведёт в поиск.</p>
								</div>
							)}
							<TeamRosterSlots
								members={teamCard?.members ?? []}
								teamId={teamCard?.id}
								tournamentId={primary?.kind === 'roster' || primary?.kind === 'apply' ? primary.gap.tournamentId : cupTournamentId}
								compact
							/>
						</div>
						<div data-home-online className="space-y-2 border-t border-line/50 pt-3">
							<div className="flex items-center justify-between gap-2">
								<p className="text-[10px] uppercase tracking-[0.14em] text-muted">На арене · 15 мин</p>
								<a href="/party-search?tab=players" className="text-xs text-aegisSoft hover:text-aegis">
									+
								</a>
							</div>
							{arenaOnline.length > 0 ? (
								<ul className="divide-y divide-line/50">
									{arenaOnline.map((player) => (
										<li key={player.id} className="flex min-h-12 items-center gap-2 py-2">
											<a href={player.href} className="flex min-w-0 flex-1 items-center gap-2 hover:opacity-90">
												<SteamAvatar url={player.avatarUrl} name={player.displayName} className="h-8 w-8 border border-line" />
												<span className="truncate text-sm text-cream">{player.displayName}</span>
											</a>
											{userId ? (
												<button
													type="button"
													onClick={() =>
														setInviteTarget({
															id: player.id,
															displayName: player.displayName,
															tournamentId: cupTournamentId ?? undefined
														})
													}
													className="shrink-0 text-xs text-aegisSoft hover:text-aegis"
												>
													пригласить
												</button>
											) : null}
										</li>
									))}
								</ul>
							) : (
								<p className="py-2 text-xs text-muted">Пока никого. Заход на главную считается «на арене».</p>
							)}
						</div>
					</aside>
					<PlatformPulse pulse={pulse} live={liveState === 'live'} />
					</div>
					<div className="flex h-full min-h-0 min-w-0 flex-col">
					<div className="flex min-h-0 flex-1 flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
					<div className="min-w-0 max-w-xl pt-6 lg:max-w-lg lg:pt-16">
					{primary?.kind === 'apply' && (
						<div>
							<ApplyReadyCard gap={primary.gap} />
						</div>
					)}
					{primary?.kind === 'roster' && (
						<article id="primary-action" className="mobile-urgent-card mobile-enter scroll-mt-20 space-y-3 p-5">
							<p className="text-xs uppercase tracking-[0.18em] text-[#FF8A5C]">{copy.kicker}</p>
							<h1 className="font-display text-2xl text-cream md:text-3xl">{copy.title}</h1>
							<p className="text-sm leading-6 text-muted">{copy.hint}</p>
							<p className="text-sm text-cream">«{primary.gap.teamName}» · Steam {primary.gap.withSteam} из 5</p>
							{(primary.gap.withoutSteam?.length || primary.gap.vacant) ? (
								<p className="text-xs text-muted">
									{primary.gap.withoutSteam?.length ? `Без Steam: ${primary.gap.withoutSteam.join(', ')}. ` : ''}
									{primary.gap.vacant ? `Свободных слотов: ${primary.gap.vacant}.` : ''}
								</p>
							) : null}
						</article>
					)}
					{primary?.kind === 'card' && (
						<article
							onContextMenu={(event) => {
								event.preventDefault();
								event.stopPropagation();
								openCardMenu(primary.card, event.clientX, event.clientY);
							}}
							id="primary-action"
							className="mobile-urgent-card mobile-enter scroll-mt-20 space-y-3 p-5"
						>
							<div className="mobile-day-banner mb-1 flex items-end justify-between gap-3 px-3.5 py-3">
								<div className="min-w-0">
									<p className="text-[10px] uppercase tracking-[0.16em] text-aegisSoft">Твой игровой день</p>
									<p className="mt-1 truncate font-display text-lg text-cream">{primary.card.title}</p>
								</div>
								{(primary.card.checkInClosesAt || primary.card.startAt) && (
									<LiveCountdown
										iso={primary.card.action.code === 'check_in' && primary.card.checkInClosesAt ? primary.card.checkInClosesAt : primary.card.startAt}
										size="lg"
										ended="Пора"
									/>
								)}
							</div>
							<div className="flex items-start justify-between gap-3">
								<div className="min-w-0">
									<p className="text-xs uppercase tracking-[0.18em] text-[#FF8A5C]">{copy.kicker}</p>
									<h1 className="mt-1 font-display text-2xl text-cream md:text-3xl">{copy.title}</h1>
									<p className="mt-2 text-sm leading-6 text-muted">{copy.hint}</p>
								</div>
								{primary.card.matchId && (
									<div className="rounded-lg border border-line bg-black/30 px-2.5 py-1 text-center">
										<div className="font-display text-xl tabular-nums text-cream">
											{primary.card.scoreA}:{primary.card.scoreB}
										</div>
										<div className="text-[10px] text-muted">BO{primary.card.bestOf}</div>
									</div>
								)}
							</div>
							<p className="text-sm text-cream">
								<span className="text-muted">{primary.card.title}</span>
								{' · '}
								{primary.card.teamName}
								{primary.card.opponentName ? ` — ${primary.card.opponentName}` : ''}
							</p>
							<MatchDayNextStep action={primaryAction ?? primary.card.action} href={primary.card.href} matchId={primary.card.matchId} steps={primary.card.checklist} />
							<PrimaryTiming card={primary.card} />
							{primary.card.isDeputy && (
								<p className="text-xs text-[#5EE7F2]">Вы заместитель: можете выложить лобби и сдать счёт, если капитан оффлайн.</p>
							)}
							{primary.card.benchNote && <p className="text-xs text-aegisSoft">{primary.card.benchNote}</p>}
							{primary.card.lobbyName && (
								<div className="space-y-1 rounded-lg border border-line bg-black/20 px-2.5 py-1.5 text-xs">
									<div className="truncate font-mono text-cream">
										{primary.card.lobbyName}
										{primary.card.lobbyPassword ? ` · ${primary.card.lobbyPassword}` : ''}
										{primary.card.lobbyRegion ? ` · ${primary.card.lobbyRegion}` : ''}
									</div>
									<CopyLobbyButton
										name={primary.card.lobbyName}
										password={primary.card.lobbyPassword}
										region={primary.card.lobbyRegion}
										voiceUrl={primary.card.lobbyVoice}
									/>
								</div>
							)}
						</article>
					)}
					{!primary && (
						<div id="primary-action" className="scroll-mt-20 space-y-3">
							<p className="text-xs uppercase tracking-[0.18em] text-aegisSoft">{copy.kicker}</p>
							<h1 className="font-display text-2xl text-cream md:text-4xl">{copy.title}</h1>
							<p className="max-w-xl text-sm leading-6 text-muted">{copy.hint}</p>
						</div>
					)}
					</div>
					<LobbyChat signedIn={Boolean(userId)} />
					</div>
					<div className="mt-auto flex flex-col items-end gap-3 pt-6 lg:flex-row lg:items-end lg:pt-10">
						<div className="grid w-full min-w-0 flex-1 items-end gap-3 sm:grid-cols-2 xl:grid-cols-3">
							<div data-home-cup>
								<PlaceCard href={cupHref} kicker="Ближайший кубок" title={cupTitle} hint={cupHint} />
							</div>
							<PlaceCard href="/heroes" kicker="Герои" title="Карточка героя" hint="Карьера, стрик, last-20." />
							{(attention.length > 0 || disputes.length > 0) ? (
								<button
									type="button"
									onClick={() => setPanel('disputes')}
									className="mobile-urgent-card flex min-h-[5.5rem] w-full items-center justify-between px-3.5 py-3 text-left"
								>
									<span>
										<span className="block text-[10px] uppercase tracking-[0.14em] text-[#FF8A5C]">Очередь организатора</span>
										<span className="mt-1 block text-sm text-cream">Заявки / споры · {attention.length + disputes.length}</span>
									</span>
									<span className="rounded-md bg-[#FF8A5C]/15 px-2 py-1 font-mono text-xs text-[#FF8A5C]">
										{attention.length + disputes.length}
									</span>
								</button>
							) : (
								<PlaceCard href="/party-search?tab=players" kicker="Пятёрка" title="Найти игроков" hint="Пустой слот — в поиск." />
							)}
						</div>
						<PlaySeal href={emptyCta.href} label={emptyCta.label} />
					</div>
					</div>
					</div>
					{secondaryCards.length > 0 && (
						<div className="space-y-3">
						<p className="text-xs uppercase tracking-[0.14em] text-muted">Ваши открытые пары</p>
						<div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
							{secondaryCards.map((card) => {
								const expanded = openId === card.id;
								return (
									<article
										key={card.id}
										onContextMenu={(event) => {
											event.preventDefault();
											event.stopPropagation();
											openCardMenu(card, event.clientX, event.clientY);
										}}
										className={`obsidian-glass rounded-card p-3.5 ${expanded ? 'md:col-span-2 xl:col-span-3' : ''}`}
									>
										<div className="flex items-start justify-between gap-2">
											<div className="min-w-0">
												<div className="truncate font-display text-base text-cream">{card.title}</div>
												<div className="mt-2">
													<MatchDayNextStep action={card.action} href={card.href} matchId={card.matchId} />
												</div>
											</div>
											<div className="flex shrink-0 items-start gap-2">
												<div className="rounded-xl border border-line bg-black/20 px-2.5 py-1 text-center">
													<div className="font-display text-xl tabular-nums text-cream">
														{card.matchId ? `${card.scoreA}:${card.scoreB}` : '—'}
													</div>
													<div className="text-[10px] text-muted">BO{card.bestOf}</div>
												</div>
												<button
													type="button"
													aria-label="Действия пары"
													onClick={(event) => {
														event.stopPropagation();
														const rect = event.currentTarget.getBoundingClientRect();
														openCardMenu(card, rect.right - 240, rect.bottom + 6);
													}}
											className="inline-flex h-11 w-11 items-center justify-center rounded-lg border border-line text-muted hover:text-cream"
										>
											<MoreHorizontal className="h-5 w-5" aria-hidden="true" />
												</button>
											</div>
										</div>
										<div className="mt-3 grid grid-cols-[1fr_auto_1fr] items-center gap-2 text-sm">
											<div className="min-w-0 truncate text-cream">{card.teamName}</div>
											<span className="text-[10px] uppercase tracking-wide text-muted">vs</span>
											<div className="min-w-0 truncate text-right text-cream">{card.opponentName ?? 'ждём соперника'}</div>
										</div>
										{card.lobbyName && (
											<div className="mt-2 space-y-1 rounded-lg border border-line bg-black/20 px-2.5 py-1.5 text-xs">
												<div className="truncate font-mono text-cream">
													{card.lobbyName}
													{card.lobbyPassword ? ` · ${card.lobbyPassword}` : ''}
													{card.lobbyRegion ? ` · ${card.lobbyRegion}` : ''}
												</div>
												{card.lobbyVoice ? (
													<a href={card.lobbyVoice} className="text-aegisSoft hover:text-aegis" target="_blank" rel="noreferrer">
														Голосовой — зайти вместе с лобби
													</a>
												) : (
													<div className="text-muted">Голосовой ещё не указан</div>
												)}
												<CopyLobbyButton
													name={card.lobbyName}
													password={card.lobbyPassword}
													region={card.lobbyRegion}
													voiceUrl={card.lobbyVoice}
												/>
											</div>
										)}
										{expanded && (
											<div className="mt-3 space-y-2 border-t border-line pt-3">
												{card.recap && <MatchRecapCard recap={card.recap} />}
												{card.roster.length > 0 && <p className="text-xs text-muted">Ваша пятёрка: {card.roster.join(', ')}</p>}
												{!card.lobbyName && card.matchId && (
													<p className="text-xs text-muted">Лобби ещё не выложено. Капитан пишет имя, пароль и голосовой на карточке турнира.</p>
												)}
											</div>
										)}
									</article>
								);
							})}
						</div>
						</div>
					)}
				</section>
			)}

			{panel === 'streams' && (
				<section className="space-y-3">
					<button type="button" onClick={() => setPanel('pairs')} className="text-sm text-aegisSoft hover:text-aegis">
						← К своему шагу
					</button>
					<p className="text-sm text-muted">Окно эфира, если орга указал канал. Счёт на карточке — арены, не net worth из катки.</p>
					{cards.length === 0 ? (
						<div className="obsidian-glass rounded-card p-5 text-sm text-muted">Пар нет — эфир появится, когда будет заявка.</div>
					) : (
						<div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
							{cards.map((card) => (
								<MatchWindow key={card.id} card={card} streams={streams} />
							))}
						</div>
					)}
				</section>
			)}

			{panel === 'plus' && (
				<section className="obsidian-glass rounded-card space-y-3 p-5">
					<button type="button" onClick={() => setPanel('pairs')} className="text-sm text-aegisSoft hover:text-aegis">
						← К своему шагу
					</button>
					<div className="font-display text-lg text-cream">Dota Plus</div>
					<p className="text-sm text-muted">
						Официальных героев в снимке: {officialHeroCount}. Это не вход на матч — только бейджи в каталоге. Не +50 за игру и не +16 арены.
					</p>
					<PlusReplaySyncButton />
					<a href="/heroes" className="inline-block text-sm text-aegisSoft hover:text-aegis">
						Открыть каталог героев
					</a>
				</section>
			)}

			{panel === 'disputes' && (
				<div className="space-y-4">
					<button type="button" onClick={() => setPanel('pairs')} className="text-sm text-aegisSoft hover:text-aegis">
						← К своему шагу
					</button>
					<div className="flex flex-wrap gap-2" role="tablist" aria-label="Очередь организатора">
						{(
							[
								{ id: 'all' as const, label: `Все · ${attention.length + disputes.length}` },
								{ id: 'attention' as const, label: `Заявки · ${attention.length}` },
								{ id: 'disputes' as const, label: `Споры · ${disputes.length}` }
							] as const
						).map((chip) => (
							<button
								key={chip.id}
								type="button"
								role="tab"
								aria-selected={staffFilter === chip.id}
								onClick={() => setStaffFilter(chip.id)}
								className={`rounded-full border px-3 py-1.5 text-xs transition ${
									staffFilter === chip.id
										? 'border-[#FF8A5C] bg-[#FF8A5C]/15 text-[#FF8A5C]'
										: 'border-line text-muted hover:text-cream'
								}`}
							>
								{chip.label}
							</button>
						))}
					</div>
					{(staffFilter === 'all' || staffFilter === 'attention') && <StaffAttentionInbox rows={attention} />}
					{(staffFilter === 'all' || staffFilter === 'disputes') && <StaffDisputeInbox rows={disputes} />}
					{staffFilter === 'attention' && attention.length === 0 ? (
						<p className="text-sm text-muted">Срочных заявок нет.</p>
					) : null}
					{staffFilter === 'disputes' && disputes.length === 0 ? (
						<p className="text-sm text-muted">Открытых споров нет.</p>
					) : null}
				</div>
			)}
			</div>

			<StickyActionBar
				href={emptyCta.href}
				label={emptyCta.label}
				hint={copy.hint}
				urgent={Boolean(primary && primary.kind !== 'card' ? true : primary?.kind === 'card' && !['done', 'browse', 'watch', 'recap'].includes(primary.card.action.code))}
				deadlineIso={
					primary?.kind === 'card'
						? primary.card.action.code === 'check_in' && primary.card.checkInClosesAt
							? primary.card.checkInClosesAt
							: primary.card.startAt
						: null
				}
			/>

			{menu && (
				<DeskMenu
					menuId="home-desk-menu"
					title={menu.card ? menu.card.title : 'Главная'}
					x={menu.x}
					y={menu.y}
					items={
						menu.card
							? [
									{ id: 'open', label: 'Открыть пару', hint: 'Карточка турнира и лобби', href: menu.card.href },
									{
										id: 'more',
										label: openId === menu.card.id ? 'Свернуть состав' : 'Состав и рекап',
										hint: 'Пятёрка и итог катки',
										onSelect: () => {
											const id = menu.card!.id;
											setOpenId((current) => (current === id ? null : id));
											setMenu(null);
										}
									},
									{ id: 'stream', label: 'Эфир этой пары', hint: 'Окно Twitch', onSelect: () => { setPanel('streams'); setMenu(null); } }
								]
							: headerItems
					}
				/>
			)}
		</div>
		</PullToRefresh>
	);
}

function PlatformPulse({ pulse, live }: { pulse: HomeArenaPulse; live: boolean }) {
	const rows = [
		{ label: 'Идут', value: pulse.live },
		{ label: 'Набор', value: pulse.registration },
		{ label: 'Отметка', value: pulse.checkIn },
		{ label: 'Пары в игре', value: pulse.liveMatches }
	].filter((row) => row.value > 0);
	const champion = pulse.champions[0];
	return (
		<section data-home-platform className="obsidian-glass space-y-3 rounded-card p-3.5">
			<p className="flex items-center gap-2 text-[10px] uppercase tracking-[0.14em] text-muted">
				Турниры
				<span
					className={`inline-block h-1.5 w-1.5 rounded-full ${live ? 'bg-radiant' : 'bg-line'}`}
					aria-label={live ? 'данные живые' : 'обновление'}
				/>
			</p>
			{rows.length > 0 && (
				<dl className="space-y-1.5 text-sm">
					{rows.map((row) => (
						<div key={row.label} className="flex items-baseline justify-between gap-3">
							<dt className="text-[10px] uppercase tracking-[0.14em] text-muted">{row.label}</dt>
							<dd className="text-cream">{row.value}</dd>
						</div>
					))}
				</dl>
			)}
			<dl className="text-sm">
				<FundRail pulse={pulse} />
			</dl>
			{champion ? (
				<div>
					<p className="text-[10px] uppercase tracking-[0.14em] text-muted">Победитель</p>
					<a href={champion.href} className="mt-1 block hover:text-aegisSoft">
						<span className="block truncate text-sm text-cream">{champion.teamName}</span>
						<span className="mt-0.5 block truncate text-xs text-muted">
							{champion.title} · {champion.prizeLabel}
						</span>
					</a>
				</div>
			) : null}
		</section>
	);
}

function FundRail({ pulse }: { pulse: HomeArenaPulse }) {
	const [open, setOpen] = useState(false);
	const fundCups = pulse.fundCups ?? [];
	const gathering = pulse.gathering ?? [];
	const hasList = fundCups.length > 0 || gathering.length > 0;
	return (
		<div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-2">
			<dt className="text-[10px] uppercase tracking-[0.14em] text-muted">Фонд</dt>
			<dd className="text-right text-cream">
				<button
					type="button"
					aria-expanded={open}
					disabled={!hasList}
					onClick={() => setOpen((current) => !current)}
					className="text-right hover:text-aegisSoft disabled:hover:text-cream"
				>
					{pulse.escrowLabel}
				</button>
			</dd>
			{open && (
				<div className="w-full space-y-3">
					{fundCups.length > 0 && (
						<ul className="space-y-2">
							{fundCups.map((cup) => (
								<li key={cup.id}>
									<a href={cup.href} className="block hover:text-aegisSoft">
										<span className="block truncate text-sm text-cream">{cup.title}</span>
										<span className="mt-0.5 block truncate text-xs text-muted">
											{cup.statusLabel} · {cup.prizeLabel} · сетка
										</span>
									</a>
								</li>
							))}
						</ul>
					)}
					<div>
						<p className="text-[10px] uppercase tracking-[0.14em] text-muted">Набор · топ 5</p>
						{gathering.length > 0 ? (
							<ol className="mt-1 space-y-2">
								{gathering.map((cup, index) => (
									<li key={cup.id}>
										<a href={cup.href} className="block hover:text-aegisSoft">
											<span className="block truncate text-sm text-cream">
												{index + 1}. {cup.title}
											</span>
											<span className="mt-0.5 block truncate text-xs text-muted">
												{cup.teamsLabel} · {cup.prizeLabel}
											</span>
										</a>
									</li>
								))}
							</ol>
						) : (
							<p className="mt-1 text-xs text-muted">Сейчас никто не набирает состав.</p>
						)}
					</div>
				</div>
			)}
		</div>
	);
}
