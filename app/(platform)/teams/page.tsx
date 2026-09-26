import { prisma } from '@/lib/prisma';
import { getCurrentSteamUser } from '@/lib/steam-session';
import { formatRankTier } from '@/lib/dota-stats';
import { mapRosterSlotPlayers } from '@/lib/team-roster';
import { listFriendBonds } from '@/server/friends';
import { TeamCatalog, type TeamCardData } from '@/components/teams/TeamCatalog';
import { buildTeamRecord, type TeamCupSource, type TeamMatchSource } from '@/lib/team-record';

export const dynamic = 'force-dynamic';

function average(values: number[]) {
	if (values.length === 0) return null;
	return Math.round(values.reduce((sum, value) => sum + value, 0) / values.length);
}

export default async function TeamsPage() {
	const currentUser = await getCurrentSteamUser();
	const teams = await prisma.team
		.findMany({
			where: { deletedAt: null },
			orderBy: { createdAt: 'desc' },
			take: 50,
			include: {
				createdBy: { select: { displayName: true, avatarUrl: true } },
				members: {
					include: {
						user: {
							select: {
								id: true,
								displayName: true,
								steamId: true,
								avatarUrl: true,
								rating: true,
								openDotaRankTier: true,
								openDotaLeaderboard: true,
								openDotaMmr: true,
								openDotaMmrSource: true
							}
						}
					},
					orderBy: [{ role: 'asc' }, { joinedAt: 'asc' }]
				}
			}
		})
		.catch(() => []);

	const teamIds = teams.map((team) => team.id);
	const [applications, matches] = teamIds.length === 0
		? [[], []]
		: await Promise.all([
			prisma.teamApplication.findMany({
				where: { teamId: { in: teamIds }, tournament: { scrimBoard: false } },
				orderBy: { updatedAt: 'desc' },
				select: {
					teamId: true,
					status: true,
					tournament: { select: { id: true, title: true, status: true } }
				}
			}),
			prisma.match.findMany({
				where: { OR: [{ teamAId: { in: teamIds } }, { teamBId: { in: teamIds } }] },
				select: {
					tournamentId: true,
					teamAId: true,
					teamBId: true,
					scoreA: true,
					scoreB: true,
					status: true,
					winnerTeamId: true,
					nextMatchId: true
				}
			})
		]).catch(() => [[], []] as const);

	const cupsByTeam = new Map<string, TeamCupSource[]>();
	for (const application of applications) {
		const list = cupsByTeam.get(application.teamId) ?? [];
		list.push({
			tournamentId: application.tournament.id,
			title: application.tournament.title,
			status: application.tournament.status,
			applicationStatus: application.status
		});
		cupsByTeam.set(application.teamId, list);
	}
	const matchRows: TeamMatchSource[] = [...matches];

	const teamCards: TeamCardData[] = teams.map((team) => {
		const confirmed = team.members.filter((member) => member.confirmed && !member.isSubstitute).length;
		const record = buildTeamRecord(team.id, cupsByTeam.get(team.id) ?? [], matchRows);
		const mmrValues = team.members
			.map((member) => member.user.openDotaMmr ?? member.user.rating ?? 0)
			.filter((value) => value > 0);

		return {
			id: team.id,
			name: team.name,
			tag: team.tag,
			game: team.game,
			description: team.description,
			logo: team.logo,
			bannerUrl: team.bannerUrl,
			videoUrl: team.videoUrl,
			contactUrl: team.contactUrl,
			region: team.region,
			language: team.language,
			playstyle: team.playstyle,
			goals: team.goals,
			recruitmentStatus: team.recruitmentStatus,
			createdById: team.createdById,
			captainName: team.createdBy.displayName,
			confirmed,
			ready: confirmed === 5,
			membersCount: team.members.length,
			membersWithStats: mmrValues.length,
			teamWinRate: record.winRate,
			wins: record.wins,
			losses: record.losses,
			cups: record.cups,
			avgMmr: average(mmrValues),
			avgKda: null,
			topRoles: [],
			roster: mapRosterSlotPlayers(team.members),
			members: team.members.map((member) => ({
				id: member.id,
				displayName: member.user.displayName,
				confirmed: member.confirmed,
				statusLabel: member.isSubstitute
					? 'запасной'
					: member.confirmed
						? `подтверждён · ${formatRankTier(member.user.openDotaRankTier ?? null)}`
						: 'ожидает'
			}))
		};
	});

	const bonds = currentUser
		? await listFriendBonds(currentUser.id).catch(() => ({ friends: [] as string[], outgoing: [] as string[], incoming: [] as string[] }))
		: { friends: [], outgoing: [], incoming: [] };

	return (
		<main className="max-w-shell mx-auto px-4 py-12 md:px-6 lg:px-10">
			<TeamCatalog teams={teamCards} currentUserId={currentUser?.id ?? null} bonds={bonds} />
		</main>
	);
}
