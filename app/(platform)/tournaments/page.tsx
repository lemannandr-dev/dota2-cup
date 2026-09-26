import { prisma } from '@/lib/prisma';
import { TournamentExplorer, type TournamentRow } from '@/components/tournaments/TournamentExplorer';
import { dotaHeroThumb } from '@/lib/dota-hero-catalog';

export const dynamic = 'force-dynamic';

const userMatchupSelect = {
	id: true,
	displayName: true,
	avatarUrl: true,
	steamId: true,
	rating: true,
	openDotaMmr: true,
	openDotaMmrSource: true,
	openDotaRankTier: true,
	openDotaLeaderboard: true
} as const;

export default async function TournamentsPage() {
	const tournaments = await prisma.tournament
		.findMany({
			where: { scrimBoard: false },
			orderBy: { startAt: 'asc' },
			take: 50,
			include: {
				applications: {
					orderBy: [{ seed: 'asc' }, { createdAt: 'asc' }],
					include: {
						team: {
							include: { members: { include: { user: { select: userMatchupSelect } } } }
						}
					}
				},
				matches: {
					orderBy: [{ round: 'asc' }, { position: 'asc' }],
					include: {
						teamA: { include: { members: { include: { user: { select: userMatchupSelect } } } } },
						teamB: { include: { members: { include: { user: { select: userMatchupSelect } } } } }
					}
				}
			}
		})
		.catch(() => []);

	const userIds = new Set<string>();
	for (const tournament of tournaments) {
		for (const application of tournament.applications) {
			for (const member of application.team?.members ?? []) userIds.add(member.user.id);
		}
		for (const match of tournament.matches) {
			for (const member of match.teamA?.members ?? []) userIds.add(member.user.id);
			for (const member of match.teamB?.members ?? []) userIds.add(member.user.id);
		}
	}

	const heroRows =
		userIds.size > 0
			? await prisma.dotaHeroProgress
					.findMany({
						where: { userId: { in: [...userIds] } },
						select: { userId: true, heroId: true, level: true, xp: true },
						orderBy: [{ level: 'desc' }, { xp: 'desc' }]
					})
					.catch(() => [])
			: [];

	const heroesByUser = new Map<string, Array<{ heroId: number; level: number; name: string | null; image: string | null }>>();
	for (const row of heroRows) {
		const list = heroesByUser.get(row.userId) ?? [];
		if (list.length >= 3) continue;
		const thumb = dotaHeroThumb(row.heroId);
		list.push({
			heroId: row.heroId,
			level: row.level,
			name: thumb?.name ?? null,
			image: thumb?.image ?? null
		});
		heroesByUser.set(row.userId, list);
	}

	type TournamentTeam = NonNullable<(typeof tournaments)[number]['applications'][number]['team']>;
	type TournamentMember = TournamentTeam['members'][number];

	const toTeam = (team: TournamentTeam | null) =>
		team
			? {
					id: team.id,
					name: team.name,
					tag: team.tag ?? null,
					logo: team.logo ?? null,
					region: team.region ?? null,
					membersCount: team.members?.length ?? 0,
					members: team.members.map((member: TournamentMember) => ({
						id: member.user.id,
						displayName: member.user.displayName,
						avatarUrl: member.user.avatarUrl ?? null,
						steamId: member.user.steamId ?? null,
						role: member.role,
						confirmed: member.confirmed,
						rankTier: member.user.openDotaRankTier ?? null,
						leaderboard: member.user.openDotaLeaderboard ?? null,
						openDotaMmr: member.user.openDotaMmr ?? null,
						openDotaMmrSource: member.user.openDotaMmrSource ?? null,
						arenaRating: member.user.rating ?? null,
						heroes: heroesByUser.get(member.user.id) ?? []
					})),
					topPlayers: team.members
						.map((member: TournamentMember) => {
							const mmr = member.user.openDotaMmr ?? member.user.rating ?? 0;
							const topHero = heroesByUser.get(member.user.id)?.[0];
							return {
								id: member.user.id,
								displayName: member.user.displayName,
								avatarUrl: member.user.avatarUrl ?? null,
								steamId: member.user.steamId ?? null,
								score: Math.round(mmr / 100),
								kda: null,
								winRate: null,
								heroName: topHero?.name ?? null,
								heroImage: topHero?.image ?? null
							};
						})
						.sort((a, b) => b.score - a.score)
						.slice(0, 3)
				}
			: null;

	const rows: TournamentRow[] = tournaments.map((tournament) => ({
		id: tournament.id,
		title: tournament.title,
		description: tournament.description,
		format: tournament.format,
		status: tournament.status,
		maxTeams: tournament.maxTeams,
		seriesRules: tournament.seriesRules,
		region: tournament.region,
		rankCap: tournament.rankCap,
		prizePool: tournament.prizePool,
		prizeCurrency: tournament.prizeCurrency,
		prizeStatus: tournament.prizeStatus,
		startAt: tournament.startAt.toISOString(),
		checkInOpensAt: tournament.checkInOpensAt?.toISOString() ?? null,
		checkInClosesAt: tournament.checkInClosesAt?.toISOString() ?? null,
		rules: tournament.rules,
		applications: tournament.applications.map((application) => ({
			id: application.id,
			status: application.status,
			seed: application.seed,
			checkedInAt: application.checkedInAt?.toISOString() ?? null,
			team: toTeam(application.team)!
		})),
		matches: tournament.matches.map((match) => ({
			id: match.id,
			round: match.round,
			position: match.position,
			bracket: match.bracket,
			bestOf: match.bestOf,
			status: match.status,
			scoreA: match.scoreA,
			scoreB: match.scoreB,
			winnerTeamId: match.winnerTeamId,
			startedAt: match.startedAt?.toISOString() ?? null,
			finishedAt: match.finishedAt?.toISOString() ?? null,
			teamA: toTeam(match.teamA),
			teamB: toTeam(match.teamB)
		}))
	}));

	return (
		<main className="max-w-shell mx-auto px-4 md:px-6 lg:px-10 py-12 space-y-8">
			<div>
				<h1 className="font-display text-3xl text-cream">Турниры</h1>
				<p className="mt-2 max-w-2xl text-sm text-muted">Таблица турниров, участники, пары команд и полная сетка по раундам.</p>
			</div>
			{rows.length === 0 ? (
				<div className="obsidian-glass rounded-card p-8 text-muted">
					Открытых турниров пока нет. Создайте свой через POST /api/tournaments или дождитесь публикации организаторов.
				</div>
			) : (
				<TournamentExplorer tournaments={rows} />
			)}
		</main>
	);
}
