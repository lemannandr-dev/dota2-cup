import { prisma } from '@/lib/prisma';
import { isLfgCupOpen, lfgCardFromRow, mapArenaPlayer, sortPartyLfg } from '@/lib/party-search';
import { listActiveLfg } from '@/server/lfg/posts';
import { storedMmrOf } from '@/server/opendota-rank';
import { countMainRoster } from '@/lib/team-roster';

export async function touchArenaPresence(userId: string) {
	await prisma.user.update({
		where: { id: userId },
		data: { lastLoginAt: new Date() }
	}).catch(() => undefined);
}

export async function loadPartySearchBoard(userId?: string | null, focusUserId?: string | null) {
	const [posts, players, myTeams, openCups] = await Promise.all([
		listActiveLfg(),
		prisma.user.findMany({
			where: { steamId: { not: null } },
			orderBy: [{ lastLoginAt: 'desc' }, { ratingGames: 'desc' }],
			take: 80,
			select: {
				id: true,
				displayName: true,
				username: true,
				steamId: true,
				rating: true,
				ratingGames: true,
				level: true,
				avatarUrl: true,
				lastLoginAt: true,
				openDotaRankTier: true,
				openDotaLeaderboard: true,
				openDotaMmr: true,
				openDotaMmrSource: true
			}
		}),
		userId
			? prisma.team.findMany({
					where: {
						deletedAt: null,
						OR: [
							{ createdById: userId },
							{ members: { some: { userId, confirmed: true } } }
						]
					},
					select: {
						id: true,
						name: true,
						tag: true,
						members: { select: { confirmed: true, isSubstitute: true, user: { select: { steamId: true } } } }
					}
				})
			: Promise.resolve([]),
		prisma.tournament.findMany({
			where: { scrimBoard: false, status: { in: ['REGISTRATION', 'CHECK_IN', 'LIVE'] } },
			orderBy: { startAt: 'asc' },
			take: 24,
			select: { id: true, title: true, status: true }
		})
	]);
	const now = Date.now();
	const lfgPosts = sortPartyLfg(
		posts.map((post) =>
			lfgCardFromRow(
				{
					...post,
					mmr: storedMmrOf(post.user)
				},
				now
			)
		),
		userId
	);
	let arenaPlayers = players.map((player) => mapArenaPlayer(player, now));
	if (focusUserId && !arenaPlayers.some((player) => player.id === focusUserId)) {
		const focused = await prisma.user.findUnique({
			where: { id: focusUserId },
			select: {
				id: true,
				displayName: true,
				username: true,
				steamId: true,
				rating: true,
				ratingGames: true,
				level: true,
				avatarUrl: true,
				lastLoginAt: true,
				openDotaRankTier: true,
				openDotaLeaderboard: true,
				openDotaMmr: true,
				openDotaMmrSource: true
			}
		});
		if (focused?.steamId) arenaPlayers = [mapArenaPlayer(focused, now), ...arenaPlayers];
	}
	return {
		lfgPosts,
		players: arenaPlayers,
		myTeams: myTeams.map((team) => {
			const roster = countMainRoster(team.members);
			return { id: team.id, name: team.name, tag: team.tag, withSteam: roster.withSteam, needed: roster.needed };
		}),
		openCups: openCups.filter((cup) => isLfgCupOpen(cup.status)),
		myLfg: userId ? lfgPosts.find((post) => post.user.id === userId) ?? null : null
	};
}
