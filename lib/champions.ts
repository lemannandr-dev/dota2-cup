import { isCupDryRun, isCupShowcase } from '@/lib/cup-label';
import { buildCupTrophy, type CupTrophyView } from '@/lib/cup-trophy';

export type Championship = {
	tournamentId: string;
	href: string;
	year: number;
	title: string;
	engraving: string;
	winnerTeamId: string;
	winnerTeamName: string;
	showcase: boolean;
	dryRun: boolean;
	userIds: string[];
	steamIds: string[];
	trophy: CupTrophyView;
};

export function championshipFromTrophy(trophy: CupTrophyView, extras?: { userIds?: string[]; steamIds?: string[] }): Championship | null {
	if (!trophy.tournamentId || !trophy.winnerTeamId) return null;
	const userIds = new Set(extras?.userIds ?? []);
	const steamIds = new Set(extras?.steamIds ?? []);
	for (const player of trophy.players) {
		if (player.userId) userIds.add(player.userId);
		if (player.steamId) steamIds.add(player.steamId);
	}
	return {
		tournamentId: trophy.tournamentId,
		href: trophy.href ?? `/tournaments/${trophy.tournamentId}/cup`,
		year: trophy.year,
		title: trophy.title,
		engraving: trophy.engraving,
		winnerTeamId: trophy.winnerTeamId,
		winnerTeamName: trophy.winnerTeamName,
		showcase: isCupShowcase(trophy.title),
		dryRun: isCupDryRun(trophy.title),
		userIds: [...userIds],
		steamIds: [...steamIds],
		trophy
	};
}

export function championshipsForTeam(all: Championship[], teamId: string) {
	return all.filter((row) => row.winnerTeamId === teamId);
}

export function championshipsForPlayer(all: Championship[], input: { userId?: string | null; steamId?: string | null }) {
	return all.filter((row) => {
		if (input.userId && row.userIds.includes(input.userId)) return true;
		if (input.steamId && row.steamIds.includes(input.steamId)) return true;
		return false;
	});
}

export async function loadChampionships(): Promise<Championship[]> {
	const { prisma } = await import('@/lib/prisma');
	const cups = await prisma.tournament.findMany({
		where: { scrimBoard: false, status: 'FINISHED' },
		orderBy: { startAt: 'desc' },
		include: {
			matches: {
				include: {
					teamA: { select: { id: true, name: true } },
					teamB: { select: { id: true, name: true } }
				}
			},
			applications: {
				include: {
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

	const records: Championship[] = [];
	for (const cup of cups) {
		const trophy = buildCupTrophy({
			tournamentId: cup.id,
			title: cup.title,
			startAt: cup.startAt,
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
		if (!trophy) continue;
		const extraUserIds: string[] = [];
		const extraSteamIds: string[] = [];
		const winnerApp = cup.applications.find((app) => app.teamId === trophy.winnerTeamId);
		for (const member of winnerApp?.team.members ?? []) {
			extraUserIds.push(member.userId);
			if (member.user.steamId) extraSteamIds.push(member.user.steamId);
		}
		const record = championshipFromTrophy(trophy, { userIds: extraUserIds, steamIds: extraSteamIds });
		if (record) records.push(record);
	}
	return records;
}
