import { prisma } from '@/lib/prisma';
import { getCurrentSteamUser } from '@/server/auth/session';
import { HomeDesk } from '@/components/home/HomeDesk';
import { SteamButton } from '@/components/dota/SteamButton';
import { loadHomeLivePayload } from '@/server/home/team';
import { loadStaffDisputeInbox } from '@/server/tournaments/staff';
import { loadStaffAttentionInbox } from '@/server/admin/attention-data';
import type { HomeArenaPlayer, HomeArenaPulse, HomeLiveCard, HomeOpenCup, HomeTeamCard, RosterGap } from '@/lib/home-live';
import { EMPTY_ARENA_PULSE } from '@/lib/home-live';
import { ArrowRight, Trophy } from 'lucide-react';
import { ArenaCover } from '@/components/layout/ArenaCover';
import { getSiteAppearance } from '@/server/site-appearance';
import { touchArenaPresence } from '@/server/party/board';
import Link from 'next/link';

export const dynamic = 'force-dynamic';

function statusLabel(status: string) {
	if (status === 'LIVE') return 'Идёт';
	if (status === 'CHECK_IN') return 'Отметка';
	return 'Набор';
}

export default async function HomeHubPage() {
	const [user, appearance] = await Promise.all([getCurrentSteamUser(), getSiteAppearance()]);
	if (!user) {
		const cups = await prisma.tournament
			.findMany({
				where: { status: { in: ['REGISTRATION', 'CHECK_IN', 'LIVE'] } },
				orderBy: { startAt: 'asc' },
				take: 3,
				select: { id: true, title: true, status: true, startAt: true }
			})
			.catch(() => []);
		return (
			<main className="arena-home mx-auto max-w-shell pb-6">
				<ArenaCover appearance={appearance} preloadArt />
				<div className="mx-auto max-w-xl space-y-8 px-4 pt-6 md:px-6 lg:px-10">
					<section className="space-y-4 text-center sm:text-left">
						<p className="font-mono text-[10px] uppercase tracking-[0.22em] text-aegisSoft">Aegis Arena</p>
						<h1 className="font-display text-3xl leading-tight text-cream md:text-4xl">Вступай в игру</h1>
						<p className="mx-auto max-w-md text-sm leading-6 text-muted sm:mx-0">
							Войди через Steam и выходи на кубок своей пятёркой. Пароль Steam сюда не попадает.
						</p>
						<div className="flex flex-col items-stretch gap-3 sm:flex-row sm:items-center">
							<SteamButton className="aegis-action min-h-12 w-full justify-center sm:w-auto" />
							<Link href="/party-search" className="inline-flex min-h-12 items-center justify-center text-sm text-muted hover:text-cream">
								Сначала найти пати
							</Link>
						</div>
					</section>

					<section aria-labelledby="home-cups-title" className="space-y-3">
						<div className="flex items-end justify-between gap-3">
							<h2 id="home-cups-title" className="font-display text-lg text-cream">
								Открытые кубки
							</h2>
							<Link href="/tournaments" className="inline-flex min-h-11 items-center gap-1 text-xs text-aegisSoft">
								Все
								<ArrowRight className="h-4 w-4" aria-hidden="true" />
							</Link>
						</div>
						{cups.length > 0 ? (
							<ul className="divide-y divide-line/60 border-t border-line/60">
								{cups.map((cup) => (
									<li key={cup.id}>
										<a href={`/tournaments/${cup.id}`} className="flex min-h-16 items-center gap-3 py-3">
											<span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-aegis/20 bg-panel">
												<Trophy className="h-5 w-5 text-aegisSoft" aria-hidden="true" />
											</span>
											<span className="min-w-0 flex-1">
												<span className="block truncate text-sm font-semibold text-cream">{cup.title}</span>
												<span className="mt-0.5 block text-xs text-muted">
													{cup.startAt.toLocaleDateString('ru-RU', {
														timeZone: 'Europe/Moscow',
														day: 'numeric',
														month: 'short'
													})}
													<span className={cup.status === 'LIVE' ? 'text-radiant' : 'text-info'}>
														{' '}
														· {statusLabel(cup.status)}
													</span>
												</span>
											</span>
											<ArrowRight className="h-4 w-4 shrink-0 text-muted" aria-hidden="true" />
										</a>
									</li>
								))}
							</ul>
						) : (
							<p className="border-t border-line/60 py-4 text-sm text-muted">
								Сейчас нет открытого набора. Войдите через Steam — соберёте пятёрку к следующему кубку.
							</p>
						)}
					</section>
				</div>
			</main>
		);
	}

	let cards: HomeLiveCard[] = [];
	let rosterGaps: RosterGap[] = [];
	let officialHeroCount = 0;
	let staffInbox: Awaited<ReturnType<typeof loadStaffDisputeInbox>> = [];
	let staffAttention: Awaited<ReturnType<typeof loadStaffAttentionInbox>> = [];
	let myTeam: HomeTeamCard | null = null;
	let nearestOpenCup: HomeOpenCup | null = null;
	let arenaOnline: HomeArenaPlayer[] = [];
	let pulse: HomeArenaPulse = EMPTY_ARENA_PULSE;
	try {
		await touchArenaPresence(user.id);
		const [payload, heroCount, inbox, attention] = await Promise.all([
			loadHomeLivePayload(user.id),
			prisma.dotaHeroProgress.count({ where: { userId: user.id } }),
			loadStaffDisputeInbox(user.id),
			loadStaffAttentionInbox(user.id)
		]);
		cards = payload.cards;
		rosterGaps = payload.rosterGaps;
		myTeam = payload.myTeam;
		nearestOpenCup = payload.nearestOpenCup;
		arenaOnline = payload.arenaOnline;
		pulse = payload.pulse;
		officialHeroCount = heroCount;
		staffInbox = inbox;
		staffAttention = attention;
	} catch (error) {
		console.error('home boards failed', error);
	}

	return (
		<main className="home-lobby mx-auto max-w-shell pb-28 md:pb-6">
			<ArenaCover appearance={appearance} stage preloadArt>
				<HomeDesk
					cards={cards}
					rosterGaps={rosterGaps}
					officialHeroCount={officialHeroCount}
					disputes={staffInbox}
					attention={staffAttention}
					userId={user.id}
					displayName={user.displayName}
					myTeam={myTeam}
					nearestOpenCup={nearestOpenCup}
					arenaOnline={arenaOnline}
					pulse={pulse}
				/>
			</ArenaCover>
		</main>
	);
}
