import { prisma } from '@/lib/prisma';
import { buildCupTrophy } from '@/lib/cup-trophy';
import { catalogActiveTeamCount } from '@/lib/tournament-catalog';
import { formatCopy } from '@/lib/tournament-copy';
import {
	groupBracketRounds,
	mapAboutCup,
	pickAboutCups,
	schematicEightBracket,
	type AboutBracketPair,
	type AboutBracketStory,
	type AboutCupCard
} from '@/lib/about-arena';

const CLOSED = new Set(['COMPLETED', 'TECHNICAL']);

function pairsFromMatches(
	tournamentId: string,
	matches: Array<{
		id: string;
		round: number;
		status: string;
		scoreA: number;
		scoreB: number;
		winnerTeamId: string | null;
		teamA: { name: string } | null;
		teamB: { name: string } | null;
	}>
): AboutBracketPair[] {
	return matches
		.filter((match) => match.teamA || match.teamB)
		.map((match) => ({
			id: match.id,
			href: `/tournaments/${tournamentId}#match-${match.id}`,
			round: match.round,
			teamA: match.teamA?.name ?? 'Ожидает',
			teamB: match.teamB?.name ?? 'Ожидает',
			scoreA: typeof match.scoreA === 'number' ? match.scoreA : null,
			scoreB: typeof match.scoreB === 'number' ? match.scoreB : null,
			live: match.status === 'LIVE',
			done: CLOSED.has(match.status) && Boolean(match.winnerTeamId)
		}));
}

export async function loadAboutBoard(): Promise<{ cups: AboutCupCard[]; bracket: AboutBracketStory }> {
	const tournaments = await prisma.tournament.findMany({
		where: { scrimBoard: false, status: { not: 'DRAFT' } },
		orderBy: { startAt: 'desc' },
		take: 8,
		select: {
			id: true,
			title: true,
			status: true,
			format: true,
			startAt: true,
			prizePool: true,
			prizeStatus: true,
			prizeCurrency: true,
			broadcast: true,
			aegisAward: true,
			maxTeams: true,
			matches: {
				orderBy: [{ round: 'asc' }, { position: 'asc' }],
				select: {
					id: true,
					round: true,
					status: true,
					scoreA: true,
					scoreB: true,
					winnerTeamId: true,
					bracket: true,
					nextMatchId: true,
					teamAId: true,
					teamBId: true,
					teamA: { select: { id: true, name: true } },
					teamB: { select: { id: true, name: true } }
				}
			},
			applications: {
				select: {
					status: true,
					teamId: true,
					rosterSnapshot: true,
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

	const mapped: AboutCupCard[] = tournaments.map((cup) => {
		const trophy = buildCupTrophy({
			tournamentId: cup.id,
			title: cup.title,
			startAt: cup.startAt,
			prizePool: cup.prizePool,
			prizeStatus: cup.prizeStatus,
			prizeCurrency: cup.prizeCurrency,
			broadcast: cup.broadcast,
			aegisAward: cup.aegisAward,
			matches: cup.matches,
			applications: cup.applications.map((app) => ({
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
		return mapAboutCup({
			id: cup.id,
			title: cup.title,
			status: cup.status,
			format: cup.format,
			prizePool: cup.prizePool,
			prizeStatus: cup.prizeStatus,
			prizeCurrency: cup.prizeCurrency,
			maxTeams: cup.maxTeams,
			teams: catalogActiveTeamCount(cup.applications),
			trophy,
			aegisAward: cup.aegisAward
		});
	});

	const live = tournaments.find((cup) => cup.status === 'LIVE' && cup.matches.some((match) => match.teamA || match.teamB));
	const finished = tournaments.find((cup) => cup.status === 'FINISHED' && cup.matches.some((match) => match.teamA || match.teamB));
	const source = live ?? finished;
	let bracket = schematicEightBracket();
	if (source) {
		const pairs = pairsFromMatches(source.id, source.matches);
		const rounds = groupBracketRounds(pairs);
		if (rounds.length) {
			bracket = {
				source: source.status === 'LIVE' ? 'live' : 'finished',
				cupId: source.id,
				cupTitle: source.title,
				href: `/tournaments/${source.id}#bracket`,
				formatLabel: formatCopy[source.format] ?? source.format,
				rounds
			};
		}
	}

	return { cups: pickAboutCups(mapped), bracket };
}
