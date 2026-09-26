import { prisma } from '@/lib/prisma';
import { pickOpenMatch } from '@/lib/match-day';
import { displayedRoster } from '@/lib/roster-swap';
import { buildReadyCheck, playersForReadyStrip } from '@/lib/ready-check';
import { readReadiness } from '@/server/tournaments/readiness';
import {
	broadcastSources,
	hasOfficialDesk,
	parseBroadcast,
	youtubeEmbedSrc
} from '@/lib/broadcast';

export async function loadTournamentBroadcast(tournamentId: string) {
	const tournament = await prisma.tournament.findUnique({
		where: { id: tournamentId },
		select: {
			id: true,
			title: true,
			status: true,
			seriesRules: true,
			broadcast: true,
			rules: true,
			applications: {
				select: {
					teamId: true,
					rosterSnapshot: true
				}
			},
			matches: {
				orderBy: [{ round: 'asc' }, { position: 'asc' }],
				select: {
					id: true,
					status: true,
					scoreA: true,
					scoreB: true,
					bestOf: true,
					winnerTeamId: true,
					rosterA: true,
					rosterB: true,
					teamA: {
						select: {
							id: true,
							name: true,
							members: {
								where: { confirmed: true },
								select: {
									isSubstitute: true,
									user: { select: { id: true, displayName: true, avatarUrl: true } }
								}
							}
						}
					},
					teamB: {
						select: {
							id: true,
							name: true,
							members: {
								where: { confirmed: true },
								select: {
									isSubstitute: true,
									user: { select: { id: true, displayName: true, avatarUrl: true } }
								}
							}
						}
					}
				}
			}
		}
	});
	if (!tournament) return null;
	const config = parseBroadcast(tournament.broadcast);
	const open = pickOpenMatch(tournament.matches);
	const pair = open ?? tournament.matches.find((match) => match.winnerTeamId) ?? null;
	const appByTeam = new Map(tournament.applications.map((row) => [row.teamId, row]));
	const membersOf = (team: { members: Array<{ isSubstitute: boolean; user: { id: string; displayName: string; avatarUrl: string | null } }> } | null) =>
		(team?.members ?? []).map((member) => ({
			userId: member.user.id,
			displayName: member.user.displayName,
			avatarUrl: member.user.avatarUrl,
			confirmed: true,
			isSubstitute: member.isSubstitute
		}));
	const sidePlayers = (
		team: { id: string; members: Array<{ isSubstitute: boolean; user: { id: string; displayName: string; avatarUrl: string | null } }> } | null,
		frozen: unknown
	) => {
		if (!team) return [];
		const app = appByTeam.get(team.id);
		return playersForReadyStrip(displayedRoster(frozen, app?.rosterSnapshot), membersOf(team));
	};
	const readyCheck = pair
		? buildReadyCheck({
				teamA: pair.teamA
					? {
							name: pair.teamA.name,
							readyStatus: readReadiness(appByTeam.get(pair.teamA.id)?.rosterSnapshot).status,
							players: sidePlayers(pair.teamA, pair.rosterA)
						}
					: null,
				teamB: pair.teamB
					? {
							name: pair.teamB.name,
							readyStatus: readReadiness(appByTeam.get(pair.teamB.id)?.rosterSnapshot).status,
							players: sidePlayers(pair.teamB, pair.rosterB)
						}
					: null
			})
		: null;
	return {
		tournamentId: tournament.id,
		title: config.overlayTitle || tournament.title,
		status: tournament.status,
		seriesRules: tournament.seriesRules,
		broadcast: config,
		hasDesk: hasOfficialDesk(config),
		sources: broadcastSources(config).map((source) => ({
			...source,
			embed: source.kind === 'youtube' ? youtubeEmbedSrc(source.youtube) : null
		})),
		pair: pair
			? {
					id: pair.id,
					status: pair.status,
					scoreA: pair.scoreA,
					scoreB: pair.scoreB,
					bestOf: pair.bestOf,
					teamA: pair.teamA ? { id: pair.teamA.id, name: pair.teamA.name } : null,
					teamB: pair.teamB ? { id: pair.teamB.id, name: pair.teamB.name } : null,
					readyCheck
				}
			: null
	};
}
