import { prisma } from '@/lib/prisma';
import { formatStoredArenaRating } from '@/lib/arena-rating';
import { formatMoscowLabel } from '@/lib/datetime';
import { mapLandingTournament, pickLandingBracket, type LandingPlayer, type LandingRoster, type LandingTournament } from '@/lib/landing-live';
import { listActiveLfg } from '@/server/lfg/posts';

export async function loadLandingPreview() {
	const [tournaments, users, lfg, teams] = await Promise.all([
		prisma.tournament.findMany({
			where: { scrimBoard: false, status: { notIn: ['DRAFT', 'CANCELLED'] } },
			orderBy: { startAt: 'asc' },
			take: 12,
			select: {
				id: true,
				title: true,
				format: true,
				seriesRules: true,
				region: true,
				rankCap: true,
				maxTeams: true,
				prizePool: true,
				prizeCurrency: true,
				prizeStatus: true,
				status: true,
				startAt: true,
				_count: { select: { applications: true } },
				matches: {
					where: { teamAId: { not: null }, teamBId: { not: null } },
					orderBy: [{ round: 'asc' }, { position: 'asc' }],
					take: 8,
					select: {
						id: true,
						status: true,
						round: true,
						bracket: true,
						bestOf: true,
						scoreA: true,
						scoreB: true,
						tournamentId: true,
						teamA: { select: { name: true } },
						teamB: { select: { name: true } }
					}
				}
			}
		}),
		prisma.user.findMany({
			where: { steamId: { not: null } },
			orderBy: [{ lastLoginAt: 'desc' }, { ratingGames: 'desc' }],
			take: 12,
			select: { id: true, displayName: true, steamId: true, rating: true, ratingGames: true }
		}),
		listActiveLfg(),
		prisma.team.findMany({
			where: { deletedAt: null },
			orderBy: { updatedAt: 'desc' },
			take: 8,
			select: {
				id: true,
				name: true,
				members: { where: { confirmed: true, isSubstitute: false }, select: { id: true } }
			}
		})
	]);

	const looking = new Map(lfg.map((post) => [post.user.id, post]));
	const cards: LandingTournament[] = tournaments.map((row) =>
		mapLandingTournament({
			id: row.id,
			title: row.title,
			format: row.format,
			seriesRules: row.seriesRules,
			region: row.region,
			rankCap: row.rankCap,
			maxTeams: row.maxTeams,
			prizePool: row.prizePool,
			prizeCurrency: row.prizeCurrency,
			prizeStatus: row.prizeStatus,
			status: row.status,
			startLabel: formatMoscowLabel(row.startAt),
			teamCount: row._count.applications
		})
	);
	const players: LandingPlayer[] = users.map((user) => {
		const post = looking.get(user.id);
		return {
			id: user.id,
			displayName: user.displayName,
			steamConfirmed: Boolean(user.steamId),
			ratingLabel: formatStoredArenaRating(user.rating, user.ratingGames),
			looking: Boolean(post),
			note: post?.note ?? null,
			roles: post?.roles ?? []
		};
	});
	const rosters: LandingRoster[] = teams
		.filter((team) => team.members.length > 0)
		.map((team) => ({
			id: team.id,
			name: team.name,
			confirmed: team.members.length,
			href: '/teams'
		}));

	return {
		tournaments: cards,
		bracket: pickLandingBracket(tournaments.flatMap((row) => row.matches)),
		players,
		rosters
	};
}
