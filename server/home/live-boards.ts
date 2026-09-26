import { prisma } from '@/lib/prisma';
import { buildMatchDayChecklist, nextMatchDayAction, pickOpenMatch, rosterFromSnapshot } from '@/lib/match-day';
import { buildMatchRecap, pickLatestClosedMatch } from '@/lib/match-recap';
import { parseMatchLobby } from '@/lib/match-lobby';
import { readReadiness } from '@/server/tournaments/readiness';
import { collectTwitchLogins } from '@/lib/twitch';
import { hasOfficialDesk, officialTwitchLogins, parseBroadcast } from '@/lib/broadcast';
import { formatMoscowLabel } from '@/lib/datetime';
import type { HomeLiveCard } from '@/lib/home-live';
import { deputyIdFromMembers } from '@/lib/team-roles';
import { loadScrimHomeCards } from '@/server/home/scrim-cards';

export type { HomeLiveCard };

function channelsOf(users: Array<{ twitchChannel?: string | null } | null | undefined>, ...texts: Array<string | null | undefined>) {
	return collectTwitchLogins(...texts, ...users.map((user) => user?.twitchChannel ?? null));
}

export async function loadHomeLiveBoards(userId: string): Promise<HomeLiveCard[]> {
	const applications = await prisma.teamApplication.findMany({
		where: { team: { members: { some: { userId } } } },
		include: {
			tournament: {
				select: {
					id: true,
					title: true,
					status: true,
					startAt: true,
					checkInClosesAt: true,
					description: true,
					rules: true,
					broadcast: true,
					prizePool: true,
					prizeStatus: true,
					prizeCurrency: true,
					matches: {
						where: {
							OR: [{ teamA: { members: { some: { userId } } } }, { teamB: { members: { some: { userId } } } }]
						},
						select: {
							id: true,
							status: true,
							scoreA: true,
							scoreB: true,
							bestOf: true,
							startedAt: true,
							winnerTeamId: true,
							finishedAt: true,
							nextMatchId: true,
							nextLoserMatchId: true,
							teamAId: true,
							teamBId: true,
							lobby: true,
							reportDeadlineAt: true,
							reports: { select: { teamId: true, reporterId: true } },
							teamA: {
								select: {
									id: true,
									name: true,
									logo: true,
									createdById: true,
									createdBy: { select: { twitchChannel: true } },
									members: { select: { user: { select: { twitchChannel: true } } } }
								}
							},
							teamB: {
								select: {
									id: true,
									name: true,
									logo: true,
									createdById: true,
									createdBy: { select: { twitchChannel: true } },
									members: { select: { user: { select: { twitchChannel: true } } } }
								}
							}
						}
					}
				}
			},
			team: {
				select: {
					id: true,
					name: true,
					logo: true,
					createdById: true,
					createdBy: { select: { twitchChannel: true } },
					members: { select: { userId: true, role: true, isSubstitute: true, confirmed: true, user: { select: { twitchChannel: true } } } }
				}
			}
		},
		orderBy: { createdAt: 'desc' },
		take: 8
	});

	const rows = applications.map((row) => {
		const teamMatches = row.tournament.matches.filter((match) => match.teamAId === row.team.id || match.teamBId === row.team.id);
		const open = pickOpenMatch(teamMatches);
		const closed = pickLatestClosedMatch(teamMatches);
		const closedOpponent =
			closed?.teamA?.id === row.team.id ? closed.teamB : closed?.teamB?.id === row.team.id ? closed.teamA : null;
		const recap = closed
			? buildMatchRecap({
					matchId: closed.id,
					status: closed.status,
					scoreA: closed.scoreA,
					scoreB: closed.scoreB,
					winnerTeamId: closed.winnerTeamId,
					teamId: row.team.id,
					teamName: row.team.name,
					opponentName: closedOpponent?.name ?? null,
					nextMatchId: closed.nextMatchId,
					nextLoserMatchId: closed.nextLoserMatchId
				})
			: null;
		const youReported = Boolean(
			open && open.reports.some((report) => report.reporterId === userId || report.teamId === row.team.id)
		);
		const deputyId = deputyIdFromMembers(row.team.members, row.team.createdById);
		const isCaptain = row.team.createdById === userId || deputyId === userId;
		const onSnapshot = new Set(rosterFromSnapshot(row.rosterSnapshot).map((player) => player.userId).filter(Boolean));
		const isSubstitute = row.team.members.some((member) => member.userId === userId && member.confirmed && member.isSubstitute);
		const benchSelf = row.team.members.some(
			(member) => member.userId === userId && member.confirmed && (member.isSubstitute || !onSnapshot.has(userId))
		);
		const benchNote =
			benchSelf && ['CHECKED_IN', 'IN_BRACKET'].includes(row.status)
				? 'Запасной · замена через капитана на карточке турнира'
				: null;
		const lobby = open && 'lobby' in open ? parseMatchLobby(open.lobby) : null;
		const checkInClosesLabel = row.tournament.checkInClosesAt
			? formatMoscowLabel(row.tournament.checkInClosesAt)
			: null;
		const dayInput = {
			tournamentStatus: row.tournament.status,
			applicationStatus: row.status,
			readyStatus: readReadiness(row.rosterSnapshot).status,
			startAt: row.tournament.startAt,
			checkInClosesLabel,
			openMatch: open
				? {
						status: open.status,
						youReported,
						lobbyPosted: Boolean(lobby),
						isCaptain,
						reportDeadlineLabel: open.reportDeadlineAt ? formatMoscowLabel(open.reportDeadlineAt) : null
					}
				: null,
			lastClosed: recap ? { won: recap.won } : null
		};
		const opponent =
			open?.teamA?.id === row.team.id ? open.teamB : open?.teamB?.id === row.team.id ? open.teamA : open?.teamB ?? null;
		const startAt = open?.startedAt ?? row.tournament.startAt;
		const official = parseBroadcast('broadcast' in row.tournament ? row.tournament.broadcast : null);
		const channels = hasOfficialDesk(official)
			? officialTwitchLogins(official, row.tournament.rules)
			: channelsOf(
					[
						row.team.createdBy,
						...row.team.members.map((member) => member.user),
						open?.teamA?.createdBy,
						...(open?.teamA?.members.map((member) => member.user) ?? []),
						open?.teamB?.createdBy,
						...(open?.teamB?.members.map((member) => member.user) ?? [])
					],
					row.tournament.rules,
					row.tournament.description
				);
		return {
			id: row.id,
			tournamentId: row.tournament.id,
			title: row.tournament.title,
			href: `/tournaments/${row.tournament.id}`,
			startAt: startAt.toISOString(),
			startLabel: formatMoscowLabel(startAt),
			teamName: row.team.name,
			teamLogo: row.team.logo ?? null,
			teamA: open?.teamA
				? { id: open.teamA.id, name: open.teamA.name, logo: open.teamA.logo ?? null }
				: closed?.teamA
					? { id: closed.teamA.id, name: closed.teamA.name, logo: closed.teamA.logo ?? null }
					: { id: row.team.id, name: row.team.name, logo: row.team.logo ?? null },
			teamB: open?.teamB
				? { id: open.teamB.id, name: open.teamB.name, logo: open.teamB.logo ?? null }
				: closed?.teamB
					? { id: closed.teamB.id, name: closed.teamB.name, logo: closed.teamB.logo ?? null }
					: null,
			scoreA: open?.scoreA ?? closed?.scoreA ?? 0,
			scoreB: open?.scoreB ?? closed?.scoreB ?? 0,
			bestOf: open?.bestOf ?? closed?.bestOf ?? 1,
			matchId: open?.id ?? closed?.id ?? null,
			matchStatus: open?.status ?? closed?.status ?? null,
			tournamentStatus: row.tournament.status,
			applicationStatus: row.status,
			action: nextMatchDayAction(dayInput),
			checklist: buildMatchDayChecklist(dayInput),
			channels,
			roster: rosterFromSnapshot(row.rosterSnapshot).map((player) => player.displayName),
			isCaptain,
			isDeputy: deputyId === userId,
			isSubstitute,
			benchNote,
			prizePool: 'prizePool' in row.tournament ? row.tournament.prizePool : 0,
			prizeStatus: 'prizeStatus' in row.tournament ? row.tournament.prizeStatus : 'NONE',
			prizeCurrency: 'prizeCurrency' in row.tournament ? row.tournament.prizeCurrency : 'RUB',
			opponentName: opponent?.name ?? null,
			opponentLogo: opponent?.logo ?? null,
			lobbyName: lobby?.name ?? null,
			lobbyPassword: lobby?.password ?? null,
			lobbyRegion: lobby?.region ?? null,
			lobbyVoice: lobby?.voiceUrl ?? null,
			lobbyPlaying: Boolean(lobby?.playing),
			recap,
			reportDeadlineLabel: open?.reportDeadlineAt ? formatMoscowLabel(open.reportDeadlineAt) : null,
			checkInClosesAt: row.tournament.checkInClosesAt?.toISOString() ?? null,
			checkInClosesLabel
		};
	});
	const scrims = await loadScrimHomeCards(userId);
	return [...rows, ...scrims];
}
