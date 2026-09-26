import { prisma } from '@/lib/prisma';
import { ARENA_ONLINE_WINDOW_MS } from '@/lib/presence';
import { playerCardHref } from '@/lib/site';
import { countMainRoster, mapRosterSlotPlayers } from '@/lib/team-roster';
import {
	buildArenaPulse,
	pickRecentChampions,
	type HomeArenaPlayer,
	type HomeArenaPulse,
	type HomeOpenCup,
	type HomeTeamCard
} from '@/lib/home-live';
import { loadHomeLiveBoards } from '@/server/home/live-boards';
import { loadRosterGaps } from '@/server/home/roster-gaps';

function formatHomeCupStart(startAt: Date) {
	return startAt.toLocaleDateString('ru-RU', {
		timeZone: 'Europe/Moscow',
		day: 'numeric',
		month: 'short'
	});
}

export async function loadHomeTeamCard(userId: string): Promise<HomeTeamCard | null> {
	const team = await prisma.team.findFirst({
		where: { deletedAt: null, members: { some: { userId, confirmed: true } } },
		select: {
			id: true,
			name: true,
			createdById: true,
			members: {
				select: {
					userId: true,
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
	if (!team) return null;
	const roster = countMainRoster(team.members);
	const me = team.members.find((member) => member.userId === userId);
	return {
		id: team.id,
		name: team.name,
		withSteam: roster.withSteam,
		needed: roster.needed,
		roleLabel: me?.isSubstitute ? 'Вы запасной' : team.createdById === userId ? 'Вы капитан' : 'Вы в пятёрке',
		members: mapRosterSlotPlayers(team.members)
	};
}

export async function loadNearestOpenCup(): Promise<HomeOpenCup | null> {
	const cup = await prisma.tournament.findFirst({
		where: { scrimBoard: false, status: { in: ['REGISTRATION', 'CHECK_IN', 'LIVE'] } },
		orderBy: { startAt: 'asc' },
		select: { id: true, title: true, status: true, startAt: true }
	});
	if (!cup) return null;
	return {
		id: cup.id,
		title: cup.title,
		href: `/tournaments/${cup.id}`,
		status: cup.status,
		startAt: cup.startAt.toISOString(),
		startLabel: formatHomeCupStart(cup.startAt)
	};
}

export async function loadHomeArenaOnline(viewerId: string, memberIds: string[] = [], take = 8): Promise<HomeArenaPlayer[]> {
	const since = new Date(Date.now() - ARENA_ONLINE_WINDOW_MS);
	const exclude = [viewerId, ...memberIds];
	const players = await prisma.user.findMany({
		where: {
			steamId: { not: null },
			id: { notIn: exclude },
			lastLoginAt: { gte: since }
		},
		orderBy: { lastLoginAt: 'desc' },
		take,
		select: { id: true, displayName: true, avatarUrl: true }
	});
	return players.map((player) => ({
		id: player.id,
		displayName: player.displayName,
		avatarUrl: player.avatarUrl,
		href: playerCardHref(player.id)
	}));
}

export async function loadHomeArenaPulse(): Promise<HomeArenaPulse> {
	const [grouped, liveMatches, prizes, finals] = await Promise.all([
		prisma.tournament.groupBy({
			by: ['status'],
			where: { scrimBoard: false, status: { in: ['REGISTRATION', 'CHECK_IN', 'LIVE'] } },
			_count: { _all: true }
		}),
		prisma.match.count({ where: { status: 'LIVE', scrim: false } }),
		prisma.tournament.findMany({
			where: { scrimBoard: false, status: { in: ['REGISTRATION', 'CHECK_IN', 'LIVE'] } },
			select: {
				id: true,
				title: true,
				status: true,
				prizePool: true,
				prizeCurrency: true,
				prizeStatus: true,
				maxTeams: true,
				startAt: true,
				_count: {
					select: {
						applications: {
							where: { status: { in: ['SUBMITTED', 'NEEDS_ACTION', 'APPROVED', 'CHECKED_IN', 'IN_BRACKET'] } }
						}
					}
				}
			}
		}),
		prisma.match.findMany({
			where: {
				winnerTeamId: { not: null },
				status: { in: ['COMPLETED', 'TECHNICAL'] },
				nextMatchId: null,
				bracket: { in: ['grand', 'winners'] },
				tournament: { status: 'FINISHED' }
			},
			orderBy: { updatedAt: 'desc' },
			take: 16,
			select: {
				tournamentId: true,
				bracket: true,
				winnerTeamId: true,
				teamA: { select: { id: true, name: true } },
				teamB: { select: { id: true, name: true } },
				tournament: {
					select: { id: true, title: true, prizePool: true, prizeCurrency: true, prizeStatus: true }
				}
			}
		})
	]);
	return buildArenaPulse({
		counts: grouped.map((row) => ({ status: row.status, count: row._count._all })),
		liveMatches,
		prizes: prizes.filter((row) => row.prizePool > 0),
		cups: prizes.map((row) => ({
			id: row.id,
			title: row.title,
			status: row.status,
			prizePool: row.prizePool,
			prizeCurrency: row.prizeCurrency,
			prizeStatus: row.prizeStatus,
			maxTeams: row.maxTeams,
			teamCount: row._count.applications,
			startAt: row.startAt.toISOString()
		})),
		champions: pickRecentChampions(finals)
	});
}

export async function loadHomeLivePayload(userId: string) {
	const [cards, rosterGaps, myTeam, nearestOpenCup, pulse] = await Promise.all([
		loadHomeLiveBoards(userId),
		loadRosterGaps(userId),
		loadHomeTeamCard(userId),
		loadNearestOpenCup(),
		loadHomeArenaPulse()
	]);
	const arenaOnline = await loadHomeArenaOnline(userId, myTeam?.members.map((member) => member.id) ?? []);
	return {
		cards,
		rosterGaps,
		myTeam,
		nearestOpenCup,
		arenaOnline,
		pulse,
		now: new Date().toISOString()
	};
}
