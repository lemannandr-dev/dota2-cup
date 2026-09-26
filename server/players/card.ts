import { prisma } from '@/lib/prisma';
import { championshipsForPlayer, loadChampionships } from '@/lib/champions';
import { mapCatalogPlayer, slimCatalogCup, type CatalogPlayer, type CatalogPlayerLfg, type CatalogViewer } from '@/lib/players-catalog';
import { mapRosterSlotPlayers, type RosterSlotPlayer } from '@/lib/team-roster';
import { listActiveLfg } from '@/server/lfg/posts';
import { loadCatalogViewer, loadPlayerExtras } from '@/server/players/catalog';
import { touchArenaPresence } from '@/server/party/board';

export type PlayerCardView = {
	player: CatalogPlayer;
	members: RosterSlotPlayer[];
	viewer: CatalogViewer;
	isSelf: boolean;
};

export async function loadPlayerCard(playerId: string, viewerId?: string | null): Promise<PlayerCardView | null> {
	if (viewerId) await touchArenaPresence(viewerId);

	const user = await prisma.user.findUnique({
		where: { id: playerId },
		select: {
			id: true,
			displayName: true,
			username: true,
			steamId: true,
			avatarUrl: true,
			rating: true,
			ratingGames: true,
			lastLoginAt: true,
			openDotaRankTier: true,
			openDotaLeaderboard: true,
			openDotaMmr: true,
			openDotaMmrSource: true
		}
	});
	if (!user) return null;

	const extras = await loadPlayerExtras([user.id]);
	const extra = extras.get(user.id);
	const [championships, posts, viewer, members] = await Promise.all([
		loadChampionships(),
		listActiveLfg(),
		loadCatalogViewer(viewerId),
		loadTeamRoster(extra?.team?.id)
	]);

	const post = posts.find((row) => row.user.id === user.id);
	const lfg: CatalogPlayerLfg | null = post
		? { id: post.id, note: post.note ?? null, roles: post.roles, cupTitle: post.tournament?.title ?? null }
		: null;

	return {
		player: mapCatalogPlayer(user, {
			team: extra?.team ?? null,
			lfg,
			openCup: extra?.openCup ?? null,
			championships: championshipsForPlayer(championships, { userId: user.id, steamId: user.steamId }).map(slimCatalogCup)
		}),
		members,
		viewer,
		isSelf: viewerId === user.id
	};
}

async function loadTeamRoster(teamId?: string | null): Promise<RosterSlotPlayer[]> {
	if (!teamId) return [];
	const team = await prisma.team.findUnique({
		where: { id: teamId },
		select: {
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
	return team ? mapRosterSlotPlayers(team.members) : [];
}
