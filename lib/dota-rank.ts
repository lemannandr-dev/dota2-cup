import { rankLabels, romanStars, type RankStars, type RankTier } from '@/lib/assets';

const TIER_BY_MEDAL: Record<number, RankTier> = {
	1: 'herald',
	2: 'guardian',
	3: 'crusader',
	4: 'archon',
	5: 'legend',
	6: 'ancient',
	7: 'divine',
	8: 'immortal'
};

export type HeaderRankMedal = {
	tier: RankTier;
	stars?: RankStars;
	leaderboard?: number;
};

export function rankMedalFromTier(rankTier: number | null | undefined, leaderboardRank?: number | null): HeaderRankMedal | null {
	if (!rankTier) return null;
	const medal = Math.floor(rankTier / 10);
	const star = rankTier % 10;
	const tier = TIER_BY_MEDAL[medal];
	if (!tier) return null;
	return {
		tier,
		...(star >= 1 && star <= 5 ? { stars: star as RankStars } : {}),
		...(typeof leaderboardRank === 'number' && leaderboardRank > 0 ? { leaderboard: leaderboardRank } : {})
	};
}

export function medalCaption(medal: HeaderRankMedal): string {
	if (medal.leaderboard) return `${rankLabels[medal.tier]} · #${medal.leaderboard}`;
	if (medal.stars) return `${rankLabels[medal.tier]} ${romanStars(medal.stars)}`;
	return rankLabels[medal.tier];
}

export type OpenDotaRank = {
	rankTier: number | null;
	leaderboardRank: number | null;
};

export type OpenDotaMmrSource = 'solo' | 'party' | 'estimate';

export type OpenDotaMmr = {
	value: number;
	source: OpenDotaMmrSource;
};

function asOpenDotaMmrValue(value: unknown): number | null {
	if (typeof value !== 'number' || !Number.isFinite(value)) return null;
	const rounded = Math.round(value);
	if (rounded <= 0 || rounded > 20000) return null;
	return rounded;
}

export function pickOpenDotaMmr(input: {
	soloCompetitiveRank?: unknown;
	competitiveRank?: unknown;
	computedMmr?: unknown;
	mmrEstimate?: unknown;
}): OpenDotaMmr | null {
	const solo = asOpenDotaMmrValue(input.soloCompetitiveRank);
	if (solo) return { value: solo, source: 'solo' };
	const party = asOpenDotaMmrValue(input.competitiveRank);
	if (party) return { value: party, source: 'party' };
	const computed = asOpenDotaMmrValue(input.computedMmr);
	if (computed) return { value: computed, source: 'estimate' };
	const estimate = asOpenDotaMmrValue(input.mmrEstimate);
	if (estimate) return { value: estimate, source: 'estimate' };
	return null;
}

export function mmrFromOpenDotaPlayer(player: unknown): OpenDotaMmr | null {
	if (!player || typeof player !== 'object') return null;
	const row = player as {
		solo_competitive_rank?: unknown;
		competitive_rank?: unknown;
		computed_mmr?: unknown;
		mmr_estimate?: { estimate?: unknown };
	};
	return pickOpenDotaMmr({
		soloCompetitiveRank: row.solo_competitive_rank,
		competitiveRank: row.competitive_rank,
		computedMmr: row.computed_mmr,
		mmrEstimate: row.mmr_estimate?.estimate
	});
}

export function storedOpenDotaMmr(value?: number | null, source?: string | null): OpenDotaMmr | null {
	const mmr = asOpenDotaMmrValue(value ?? null);
	if (!mmr) return null;
	const nextSource: OpenDotaMmrSource = source === 'solo' || source === 'party' ? source : 'estimate';
	return { value: mmr, source: nextSource };
}

export function pickStoredOpenDotaMmr(live: OpenDotaMmr | null | undefined, stored: OpenDotaMmr | null | undefined): OpenDotaMmr | null {
	return live ?? stored ?? null;
}

export function formatOpenDotaMmr(mmr: OpenDotaMmr): string {
	if (mmr.source === 'solo') return `MMR ${mmr.value}`;
	if (mmr.source === 'party') return `пати MMR ${mmr.value}`;
	return `оценка OpenDota ${mmr.value}`;
}

export function formatOpenDotaMmrCompact(mmr: OpenDotaMmr): string {
	if (mmr.source === 'solo') return `MMR ${mmr.value}`;
	if (mmr.source === 'party') return `пати ${mmr.value}`;
	return `оценка ${mmr.value}`;
}

export function pickOpenDotaRank(live: OpenDotaRank | null | undefined, stored: OpenDotaRank | null | undefined): OpenDotaRank | null {
	if (live?.rankTier) return live;
	if (stored?.rankTier) return stored;
	return null;
}

/** Stored OpenDota medal fields from Prisma User — for list SSR (no live fetch). */
export function storedRankOf(
	user: { openDotaRankTier?: number | null; openDotaLeaderboard?: number | null } | null | undefined
): OpenDotaRank | null {
	if (!user?.openDotaRankTier) return null;
	return { rankTier: user.openDotaRankTier, leaderboardRank: user.openDotaLeaderboard ?? null };
}

export function storedMedalOf(
	user: { openDotaRankTier?: number | null; openDotaLeaderboard?: number | null } | null | undefined
): HeaderRankMedal | null {
	const rank = storedRankOf(user);
	return rankMedalFromTier(rank?.rankTier, rank?.leaderboardRank);
}
