import { prisma } from '@/lib/prisma';
import { formatMoscowLabel } from '@/lib/datetime';
import { isCupDryRun, isCupShowcase } from '@/lib/cup-label';
import { pickFinalMatch } from '@/lib/prize-places';
import {
	catalogActiveTeamCount,
	catalogFeaturedPair,
	catalogLiveMatchCount,
	catalogMyHint,
	catalogOpenMatches,
	pickCatalogMine,
	type CatalogCup,
	type CatalogMine
} from '@/lib/tournament-catalog';
import { countMainRoster, mapRosterSlotPlayers } from '@/lib/team-roster';

export async function loadTournamentCatalog(userId?: string | null): Promise<CatalogCup[]> {
	const where = userId
		? { scrimBoard: false, OR: [{ status: { not: 'DRAFT' as const } }, { createdById: userId }] }
		: { scrimBoard: false, status: { not: 'DRAFT' as const } };

	const tournaments = await prisma.tournament.findMany({
		where,
		orderBy: { startAt: 'asc' },
		take: 50,
		select: {
			id: true,
			title: true,
			format: true,
			status: true,
			maxTeams: true,
			seriesRules: true,
			region: true,
			rankCap: true,
			prizePool: true,
			prizeCurrency: true,
			prizeStatus: true,
			aegisAward: true,
			inviteOnly: true,
			startAt: true,
			applications: {
				select: {
					status: true,
					team: {
						select: {
							id: true,
							name: true,
							createdById: true,
							members: {
								where: { userId: userId ?? '__none__', confirmed: true },
								select: { userId: true, role: true, isSubstitute: true }
							}
						}
					}
				}
			},
			matches: {
				select: {
					status: true,
					scoreA: true,
					scoreB: true,
					bestOf: true,
					winnerTeamId: true,
					bracket: true,
					nextMatchId: true,
					teamAId: true,
					teamBId: true,
					teamA: { select: { id: true, name: true } },
					teamB: { select: { id: true, name: true } }
				}
			}
		}
	});

	const cups = tournaments.map((tournament) => {
		const teams = catalogActiveTeamCount(tournament.applications);
		const open = catalogOpenMatches(tournament.matches);
		const live = catalogLiveMatchCount(tournament.matches);
		const pair = catalogFeaturedPair(tournament.matches);
		const final = pickFinalMatch(tournament.matches);
		const championTeam = final?.winnerTeamId
			? final.teamA?.id === final.winnerTeamId
				? final.teamA
				: final.teamB?.id === final.winnerTeamId
					? final.teamB
					: null
			: null;
		const mineApps = tournament.applications.filter((row) => row.team.members.length > 0);
		const picked = pickCatalogMine(mineApps);
		const isCaptain = picked
			? picked.team.createdById === userId ||
				picked.team.members.some((member) => member.role === 'captain' && !member.isSubstitute)
			: false;
		const mine: CatalogMine | null = picked
			? {
					teamId: picked.team.id,
					teamName: picked.team.name,
					applicationStatus: picked.status,
					isCaptain,
					extraTeams: Math.max(0, mineApps.length - 1),
					hint: catalogMyHint({
						teamName: picked.team.name,
						applicationStatus: picked.status,
						cupStatus: tournament.status,
						isCaptain,
						extraTeams: Math.max(0, mineApps.length - 1)
					}),
					withSteam: 0,
					needed: 5,
					members: []
				}
			: null;
		return {
			id: tournament.id,
			title: tournament.title,
			href: `/tournaments/${tournament.id}`,
			format: tournament.format,
			status: tournament.status,
			maxTeams: tournament.maxTeams,
			seriesRules: tournament.seriesRules,
			region: tournament.region,
			rankCap: tournament.rankCap,
			prizePool: tournament.prizePool,
			prizeCurrency: tournament.prizeCurrency,
			prizeStatus: tournament.prizeStatus,
			aegisAward: tournament.aegisAward,
			inviteOnly: tournament.inviteOnly,
			startAt: tournament.startAt.toISOString(),
			startAtLabel: formatMoscowLabel(tournament.startAt),
			teams,
			openMatches: open.length,
			liveMatches: live,
			pair,
			championName: championTeam?.name ?? null,
			dryRun: isCupDryRun(tournament.title),
			showcase: isCupShowcase(tournament.title),
			mine
		};
	});

	const rosterIds = [...new Set(cups.map((cup) => cup.mine?.teamId).filter(Boolean))] as string[];
	if (!rosterIds.length) return cups;

	const rosters = await prisma.team.findMany({
		where: { id: { in: rosterIds } },
		select: {
			id: true,
			members: {
				where: { confirmed: true, isSubstitute: false },
				select: {
					confirmed: true,
					isSubstitute: true,
					user: {
						select: {
							id: true,
							displayName: true,
							avatarUrl: true,
							steamId: true,
							openDotaRankTier: true,
							openDotaLeaderboard: true,
							openDotaMmr: true,
							openDotaMmrSource: true
						}
					}
				}
			}
		}
	});
	const byTeam = new Map(rosters.map((team) => [team.id, team]));
	return cups.map((cup) => {
		if (!cup.mine) return cup;
		const team = byTeam.get(cup.mine.teamId);
		if (!team) return cup;
		const roster = countMainRoster(team.members);
		return {
			...cup,
			mine: {
				...cup.mine,
				withSteam: roster.withSteam,
				needed: roster.needed,
				members: mapRosterSlotPlayers(team.members)
			}
		};
	});
}
