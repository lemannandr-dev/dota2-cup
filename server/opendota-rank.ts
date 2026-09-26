import { fetchOpenDotaRankBySteamId } from '@/lib/dota-stats';
import {
	pickOpenDotaRank,
	pickStoredOpenDotaMmr,
	rankMedalFromTier,
	storedOpenDotaMmr,
	storedRankOf,
	type HeaderRankMedal,
	type OpenDotaMmr,
	type OpenDotaRank
} from '@/lib/dota-rank';
import { prisma } from '@/lib/prisma';

export { storedRankOf } from '@/lib/dota-rank';

type RankMemory = OpenDotaRank & { mmr?: OpenDotaMmr | null };

const memory = new Map<string, RankMemory>();

export async function persistOpenDotaRank(steamId: string, rank: OpenDotaRank, mmr?: OpenDotaMmr | null) {
	if (!rank.rankTier && !mmr) return;
	memory.set(steamId, { ...rank, mmr: mmr ?? null });
	await prisma.user
		.updateMany({
			where: { steamId },
			data: {
				...(rank.rankTier
					? {
							openDotaRankTier: rank.rankTier,
							openDotaLeaderboard: rank.leaderboardRank,
							openDotaRankAt: new Date()
						}
					: mmr
						? { openDotaRankAt: new Date() }
						: {}),
				...(mmr
					? {
							openDotaMmr: mmr.value,
							openDotaMmrSource: mmr.source
						}
					: {})
			}
		})
		.catch(() => undefined);
}

export function storedMmrOf(user: { openDotaMmr?: number | null; openDotaMmrSource?: string | null } | null | undefined): OpenDotaMmr | null {
	return storedOpenDotaMmr(user?.openDotaMmr, user?.openDotaMmrSource);
}

function refreshOpenDotaRank(steamId: string) {
	void fetchOpenDotaRankBySteamId(steamId)
		.then((live) => {
			if (!live) return;
			const mmr = storedOpenDotaMmr(live.mmr, live.mmrSource);
			if (live.rankTier || mmr) return persistOpenDotaRank(steamId, live, mmr);
		})
		.catch(() => undefined);
}

export async function resolveOpenDotaRank(steamId: string | null | undefined, stored?: OpenDotaRank | null): Promise<OpenDotaRank | null> {
	if (!steamId) return stored?.rankTier ? stored : null;
	const remembered = memory.get(steamId) ?? stored ?? null;
	if (remembered?.rankTier) {
		refreshOpenDotaRank(steamId);
		return remembered;
	}
	const live = await fetchOpenDotaRankBySteamId(steamId);
	const mmr = storedOpenDotaMmr(live?.mmr, live?.mmrSource);
	if (live?.rankTier || mmr) await persistOpenDotaRank(steamId, live ?? { rankTier: null, leaderboardRank: null }, mmr);
	return pickOpenDotaRank(live, remembered);
}

export async function resolveOpenDotaMmr(steamId: string | null | undefined, stored?: OpenDotaMmr | null): Promise<OpenDotaMmr | null> {
	if (!steamId) return stored ?? null;
	const remembered = memory.get(steamId)?.mmr ?? stored ?? null;
	if (remembered) {
		refreshOpenDotaRank(steamId);
		return remembered;
	}
	const live = await fetchOpenDotaRankBySteamId(steamId);
	const mmr = pickStoredOpenDotaMmr(storedOpenDotaMmr(live?.mmr, live?.mmrSource), stored);
	if (live?.rankTier || mmr) await persistOpenDotaRank(steamId, live ?? { rankTier: null, leaderboardRank: null }, mmr);
	return mmr;
}

export async function resolveOpenDotaMedal(steamId: string | null | undefined, stored?: OpenDotaRank | null): Promise<HeaderRankMedal | null> {
	const rank = await resolveOpenDotaRank(steamId, stored);
	return rankMedalFromTier(rank?.rankTier, rank?.leaderboardRank);
}

export async function resolveOpenDotaSnapshot(
	steamId: string | null | undefined,
	storedRank?: OpenDotaRank | null,
	storedMmr?: OpenDotaMmr | null
): Promise<{ medal: HeaderRankMedal | null; mmr: OpenDotaMmr | null }> {
	const medal = await resolveOpenDotaMedal(steamId, storedRank);
	const mmr = await resolveOpenDotaMmr(steamId, storedMmr);
	return { medal, mmr };
}

export async function loadOpenDotaMedals(
	players: Array<{ steamId?: string | null; openDotaRankTier?: number | null; openDotaLeaderboard?: number | null }>
) {
	const medals = new Map<string, HeaderRankMedal>();
	const unique = [...new Map(players.filter((player) => player.steamId).map((player) => [player.steamId as string, player])).values()].slice(0, 40);
	await Promise.all(
		unique.map(async (player) => {
			const medal = await resolveOpenDotaMedal(player.steamId, storedRankOf(player));
			if (medal && player.steamId) medals.set(player.steamId, medal);
		})
	);
	return medals;
}
