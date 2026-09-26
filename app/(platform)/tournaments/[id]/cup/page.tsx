import Link from 'next/link';
import { notFound } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import { buildCupTrophy } from '@/lib/cup-trophy';
import { CupTrophy } from '@/components/tournaments/CupTrophy';
import { isCupDryRun, isCupShowcase } from '@/lib/cup-label';
import { StatusPill } from '@/components/dota/StatusPill';
import { bracketCopy, matchStatusCopy } from '@/lib/tournament-copy';

export const dynamic = 'force-dynamic';

export default async function TournamentCupPage({ params }: { params: Promise<{ id: string }> }) {
	const { id } = await params;
	const tournament = await prisma.tournament.findUnique({
		where: { id },
		include: {
			matches: {
				orderBy: [{ bracket: 'asc' }, { round: 'asc' }, { position: 'asc' }],
				include: {
					teamA: { select: { id: true, name: true } },
					teamB: { select: { id: true, name: true } }
				}
			},
			applications: {
				include: {
					team: {
						select: {
							id: true,
							name: true,
							members: {
								select: {
									userId: true,
									user: { select: { id: true, displayName: true, steamId: true } }
								}
							}
						}
					}
				}
			}
		}
	});
	if (!tournament || tournament.status === 'DRAFT') notFound();

	const trophy = buildCupTrophy({
		tournamentId: tournament.id,
		title: tournament.title,
		startAt: tournament.startAt,
		prizePool: tournament.prizePool,
		prizeStatus: tournament.prizeStatus,
		prizeCurrency: tournament.prizeCurrency,
		broadcast: tournament.broadcast,
		aegisAward: tournament.aegisAward,
		matches: tournament.matches,
		applications: tournament.applications.map((app) => ({
			teamId: app.teamId,
			rosterSnapshot: app.rosterSnapshot,
			team: {
				id: app.team.id,
				name: app.team.name,
				members: app.team.members.map((member) => ({
					userId: member.userId,
					user: member.user
				}))
			}
		}))
	});
	if (!trophy) notFound();

	const played = tournament.matches.filter((match) => ['COMPLETED', 'TECHNICAL'].includes(match.status) && match.winnerTeamId);

	return (
		<main className="mx-auto max-w-shell space-y-6 px-4 py-10 md:px-6 lg:px-10">
			<div>
				<Link href="/players" className="text-xs text-aegisSoft">
					← К игрокам
				</Link>
				<h1 className="mt-2 font-display text-3xl text-cream">Кубок {trophy.year}</h1>
				<p className="mt-2 max-w-2xl text-sm text-muted">
					Чемпионы и закрытые пары. Сетка судьи, лобби и записи матчей — на карточке турнира, не здесь.
				</p>
				<div className="mt-3 flex flex-wrap gap-2">
					{isCupShowcase(tournament.title) && <StatusPill tone="aegis">витрина кубка</StatusPill>}
					{isCupDryRun(tournament.title) && <StatusPill tone="muted">прогон стенда</StatusPill>}
					<StatusPill tone="muted">завершён</StatusPill>
				</div>
			</div>

			<CupTrophy trophy={{ ...trophy, href: undefined }} />

			<section className="obsidian-glass rounded-card p-5">
				<h2 className="font-display text-lg text-cream">Кто сыграл</h2>
				{played.length === 0 ? (
					<p className="mt-2 text-sm text-muted">Закрытых пар нет — в финале нет записанного счёта.</p>
				) : (
					<ul className="mt-3 divide-y divide-line/60">
						{played.map((match) => (
							<li key={match.id} className="flex flex-wrap items-baseline justify-between gap-2 py-2 text-sm">
								<span className="text-muted">
									{bracketCopy[match.bracket] ?? match.bracket}
									{match.round ? ` · раунд ${match.round}` : ''}
								</span>
								<span className="min-w-0 text-cream">
									{match.teamA?.name ?? '—'} — {match.teamB?.name ?? '—'}
								</span>
								<span className="tabular-nums text-[#F8E7A0]">
									{match.scoreA}:{match.scoreB}
									{match.status === 'TECHNICAL' ? ` · ${matchStatusCopy.TECHNICAL}` : ''}
								</span>
							</li>
						))}
					</ul>
				)}
			</section>

			<p className="text-sm text-muted">
				<Link href={`/tournaments/${tournament.id}`} className="text-aegisSoft hover:text-aegis">
					Открыть карточку турнира
				</Link>
				{' · сетка, готовность, записи пар'}
			</p>
		</main>
	);
}
