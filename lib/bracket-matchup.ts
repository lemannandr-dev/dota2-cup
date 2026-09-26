import { medalCaption, rankMedalFromTier, storedOpenDotaMmr, type HeaderRankMedal } from '@/lib/dota-rank';

export type MatchupPlayerHero = {
	heroId: number;
	level: number;
	name?: string | null;
	image?: string | null;
};

export type MatchupPlayer = {
	id: string;
	displayName: string;
	avatarUrl: string | null;
	role?: string | null;
	confirmed?: boolean;
	rankTier?: number | null;
	leaderboard?: number | null;
	openDotaMmr?: number | null;
	openDotaMmrSource?: string | null;
	arenaRating?: number | null;
	heroes?: MatchupPlayerHero[];
};

export type MatchupTeam = {
	id: string;
	name: string;
	tag?: string | null;
	logo?: string | null;
	members: MatchupPlayer[];
};

export type PlayerEdge = {
	playerId: string;
	displayName: string;
	avatarUrl: string | null;
	medal: HeaderRankMedal | null;
	mmrLabel: string | null;
	strength: number;
	winChanceVsOpp: number;
	heroes: MatchupPlayerHero[];
};

export type TeamMatchup = {
	teamAId: string;
	teamBId: string;
	teamAWinPct: number;
	teamBWinPct: number;
	teamAStrength: number;
	teamBStrength: number;
	sideA: PlayerEdge[];
	sideB: PlayerEdge[];
	confidence: 'low' | 'medium' | 'high';
	hint: string;
};

/** Approximate mid-MMR from OpenDota rank_tier (medal*10+stars). */
export function estimateMmrFromRankTier(rankTier: number | null | undefined): number | null {
	if (!rankTier || rankTier < 10) return null;
	const medal = Math.floor(rankTier / 10);
	const stars = Math.min(5, Math.max(0, rankTier % 10));
	const baseByMedal: Record<number, number> = {
		1: 0,
		2: 770,
		3: 1540,
		4: 2310,
		5: 3080,
		6: 3850,
		7: 4620,
		8: 5420
	};
	const base = baseByMedal[medal];
	if (base == null) return null;
	const step = medal >= 8 ? 0 : 154;
	return Math.round(base + Math.max(0, stars - 1) * step);
}

/**
 * Player strength for matchup: prefer stored OpenDota MMR, then rank estimate, then arena rating.
 * Plus hero depth adds a small calibrated bonus (not inventing Valve MMR).
 */
export function playerMatchupStrength(player: MatchupPlayer): number {
	const stored = storedOpenDotaMmr(player.openDotaMmr, player.openDotaMmrSource);
	const fromRank = estimateMmrFromRankTier(player.rankTier);
	const arena = typeof player.arenaRating === 'number' && player.arenaRating > 0 ? player.arenaRating : null;
	let base = stored?.value ?? fromRank ?? arena ?? 2500;
	const heroes = player.heroes ?? [];
	if (heroes.length > 0) {
		const depth = Math.min(5, heroes.length);
		const masterish = heroes.filter((h) => h.level >= 18).length;
		base += depth * 12 + masterish * 18;
	}
	return Math.max(200, Math.min(9000, Math.round(base)));
}

/** Elo-style win probability. */
export function eloWinChance(strengthA: number, strengthB: number): number {
	const diff = strengthA - strengthB;
	const p = 1 / (1 + Math.pow(10, -diff / 400));
	return Math.round(p * 1000) / 1000;
}

function rosterOf(team: MatchupTeam): MatchupPlayer[] {
	const confirmed = team.members.filter((m) => m.confirmed !== false);
	const pool = confirmed.length > 0 ? confirmed : team.members;
	return pool.slice(0, 5);
}

function teamStrength(players: MatchupPlayer[]): number {
	if (players.length === 0) return 2500;
	const strengths = players.map(playerMatchupStrength);
	const sum = strengths.reduce((a, b) => a + b, 0);
	return Math.round(sum / strengths.length);
}

function edgeFor(player: MatchupPlayer, oppStrength: number): PlayerEdge {
	const strength = playerMatchupStrength(player);
	const stored = storedOpenDotaMmr(player.openDotaMmr, player.openDotaMmrSource);
	const medal = rankMedalFromTier(player.rankTier, player.leaderboard);
	return {
		playerId: player.id,
		displayName: player.displayName,
		avatarUrl: player.avatarUrl,
		medal,
		mmrLabel: stored
			? `MMR ${stored.value}`
			: medal
				? medalCaption(medal)
				: player.arenaRating
					? `арена ${player.arenaRating}`
					: null,
		strength,
		winChanceVsOpp: eloWinChance(strength, oppStrength),
		heroes: (player.heroes ?? []).slice(0, 3)
	};
}

export function buildTeamMatchup(teamA: MatchupTeam, teamB: MatchupTeam): TeamMatchup {
	const rosterA = rosterOf(teamA);
	const rosterB = rosterOf(teamB);
	const strengthA = teamStrength(rosterA);
	const strengthB = teamStrength(rosterB);
	const teamAWin = eloWinChance(strengthA, strengthB);
	const known =
		rosterA.filter((p) => p.openDotaMmr || p.rankTier || p.arenaRating).length +
		rosterB.filter((p) => p.openDotaMmr || p.rankTier || p.arenaRating).length;
	const confidence: TeamMatchup['confidence'] =
		known >= 8 ? 'high' : known >= 4 ? 'medium' : 'low';
	const hint =
		confidence === 'low'
			? 'Мало кэша OpenDota — оценка грубая. Момент катки клиент не отдаёт.'
			: confidence === 'medium'
				? 'Считаем по кэшу OpenDota, арене и Plus-пулу. Момент катки клиент не отдаёт.'
				: 'Считаем по кэшу OpenDota, медалям и Plus-героям. Момент катки клиент не отдаёт.';

	return {
		teamAId: teamA.id,
		teamBId: teamB.id,
		teamAWinPct: Math.round(teamAWin * 100),
		teamBWinPct: Math.round((1 - teamAWin) * 100),
		teamAStrength: strengthA,
		teamBStrength: strengthB,
		sideA: rosterA.map((p) => edgeFor(p, strengthB)).sort((a, b) => b.winChanceVsOpp - a.winChanceVsOpp),
		sideB: rosterB.map((p) => edgeFor(p, strengthA)).sort((a, b) => b.winChanceVsOpp - a.winChanceVsOpp),
		confidence,
		hint
	};
}
