import { prisma } from '@/lib/prisma';
import { championshipsForPlayer, loadChampionships } from '@/lib/champions';
import {
	catalogOpenCupHint,
	catalogTeamRoleLabel,
	mapCatalogPlayer,
	pickCatalogOpenCup,
	pickCatalogPlayerTeam,
	slimCatalogCup,
	sortCatalogPlayers,
	type CatalogPlayer,
	type CatalogPlayerLfg,
	type CatalogPlayerOpenCup,
	type CatalogPlayerTeam,
	type CatalogViewer
} from '@/lib/players-catalog';
import { countMainRoster } from '@/lib/team-roster';
import { listActiveLfg } from '@/server/lfg/posts';
import { touchArenaPresence } from '@/server/party/board';

const userSelect = {
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
} as const;

export async function loadPlayersCatalog(viewerId?: string | null): Promise<{ players: CatalogPlayer[]; viewer: CatalogViewer }> {
	if (viewerId) await touchArenaPresence(viewerId);

	const [users, posts, championships, viewer] = await Promise.all([
		prisma.user.findMany({
			orderBy: [{ lastLoginAt: 'desc' }, { ratingGames: 'desc' }],
			take: 50,
			select: userSelect
		}),
		listActiveLfg(),
		loadChampionships(),
		loadCatalogViewer(viewerId)
	]);

	const extras = await loadPlayerExtras(users.map((user) => user.id));
	const lfgByUser = new Map<string, CatalogPlayerLfg>();
	for (const post of posts) {
		if (lfgByUser.has(post.user.id)) continue;
		lfgByUser.set(post.user.id, {
			id: post.id,
			note: post.note ?? null,
			roles: post.roles,
			cupTitle: post.tournament?.title ?? null
		});
	}

	const players = sortCatalogPlayers(
		users.map((user) => {
			const extra = extras.get(user.id);
			return mapCatalogPlayer(user, {
				team: extra?.team ?? null,
				lfg: lfgByUser.get(user.id) ?? null,
				openCup: extra?.openCup ?? null,
				championships: championshipsForPlayer(championships, { userId: user.id, steamId: user.steamId }).map(slimCatalogCup)
			});
		})
	);

	return { players, viewer };
}

export async function loadCatalogViewer(viewerId?: string | null): Promise<CatalogViewer> {
	if (!viewerId) return { id: null, canInvite: false, inviteTeamId: null };
	const teams = await prisma.team.findMany({
		where: {
			deletedAt: null,
			OR: [{ createdById: viewerId }, { members: { some: { userId: viewerId, confirmed: true } } }]
		},
		select: { id: true },
		take: 8
	});
	return {
		id: viewerId,
		canInvite: true,
		inviteTeamId: teams[0]?.id ?? null
	};
}

export async function loadPlayerExtras(userIds: string[]) {
	const extras = new Map<string, { team: CatalogPlayerTeam | null; openCup: CatalogPlayerOpenCup | null }>();
	if (!userIds.length) return extras;

	const memberships = await prisma.teamMember.findMany({
		where: { userId: { in: userIds }, confirmed: true, team: { deletedAt: null } },
		select: {
			userId: true,
			role: true,
			isSubstitute: true,
			team: {
				select: {
					id: true,
					name: true,
					createdById: true,
					members: {
						where: { confirmed: true, isSubstitute: false },
						select: { confirmed: true, isSubstitute: true, user: { select: { steamId: true } } }
					},
					applications: {
						select: {
							status: true,
							tournament: { select: { id: true, title: true, status: true } }
						}
					}
				}
			}
		}
	});

	const byUser = new Map<string, typeof memberships>();
	for (const row of memberships) {
		const list = byUser.get(row.userId) ?? [];
		list.push(row);
		byUser.set(row.userId, list);
	}

	for (const userId of userIds) {
		const rows = byUser.get(userId) ?? [];
		const picked = pickCatalogPlayerTeam(rows, userId);
		if (!picked) {
			extras.set(userId, { team: null, openCup: null });
			continue;
		}
		const roster = countMainRoster(picked.team.members);
		const extraTeams = Math.max(0, new Set(rows.map((row) => row.team.id)).size - 1);
		const team: CatalogPlayerTeam = {
			id: picked.team.id,
			name: picked.team.name,
			roleLabel: catalogTeamRoleLabel({
				isSubstitute: picked.isSubstitute,
				isCaptain: picked.team.createdById === userId || picked.role === 'captain'
			}),
			withSteam: roster.withSteam,
			needed: roster.needed,
			extraTeams
		};
		const app = pickCatalogOpenCup(picked.team.applications);
		const openCup: CatalogPlayerOpenCup | null = app
			? {
					id: app.tournament.id,
					title: app.tournament.title,
					href: `/tournaments/${app.tournament.id}`,
					status: app.tournament.status,
					applicationStatus: app.status,
					hint: catalogOpenCupHint({
						teamName: picked.team.name,
						applicationStatus: app.status,
						cupStatus: app.tournament.status,
						cupTitle: app.tournament.title
					})
				}
			: null;
		extras.set(userId, { team, openCup });
	}

	return extras;
}
