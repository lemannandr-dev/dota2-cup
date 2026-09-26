import { plusProgressFromMatches, type PlusHeroTier } from '@/lib/dota-plus-hero';
import { mmrFromOpenDotaPlayer } from '@/lib/dota-rank';
import { heroImageFromApiName as localHeroImage, heroImageCdn } from '@/lib/hero-image';

const STEAM_ID_64_BASE = BigInt('76561197960265728');

export type DotaStats = {
	accountId: number;
	rankTier: number | null;
	leaderboardRank: number | null;
	mmrEstimate: number | null;
	competitiveRank: number | null;
	soloCompetitiveRank: number | null;
	win: number | null;
	lose: number | null;
	winRate: number | null;
};

export type TopHeroStat = {
	heroId: number;
	heroName: string;
	heroImage: string;
	games: number;
	win: number;
	winRate: number;
	lastPlayed: number;
};

export type RecentMatchStat = {
	matchId: number;
	heroName: string;
	heroImage: string;
	kills: number;
	deaths: number;
	assists: number;
	gpm: number;
	xpm: number;
	durationMinutes: number;
	startedAt: number;
	didWin: boolean;
	role: string;
	patchLabel: string;
};

export type WinrateBucket = {
	label: string;
	games: number;
	wins: number;
	winRate: number;
};

export type DotaAverages = {
	kills: number;
	deaths: number;
	assists: number;
	kda: number;
	gpm: number;
	xpm: number;
};

export type DotaProfileAnalytics = DotaStats & {
	source: 'OpenDota';
	fetchedAt: string;
	hasPublicMatchData: boolean;
	hasPrivateHistory: boolean;
	isDotaPlus: boolean;
	topHeroes: TopHeroStat[];
	heroesProgress: HeroProgress[];
	allHeroesProgress: HeroProgress[];
	recentMatches: RecentMatchStat[];
	favoriteRoles: FavoriteRole[];
	formTrend: FormTrendPoint[];
	roleWinrates: WinrateBucket[];
	patchWinrates: WinrateBucket[];
	averages: DotaAverages | null;
};

export type FavoriteRole = {
	role: string;
	games: number;
	wins: number;
	pickRate: number;
	winRate: number;
};

export type FormTrendPoint = {
	index: number;
	matchId: number;
	didWin: boolean;
	cumulative: number;
	dateLabel: string;
};

export type HeroHistoryItem = {
	matchId: number;
	startedAt: number;
	result: 'Выиграл' | 'Проиграл';
	kda: string;
	role: string;
	patchLabel: string;
};

export type HeroProgress = {
	heroId: number;
	heroName: string;
	heroImage: string;
	games: number;
	win: number;
	winRate: number;
	lastPlayed: number;
	level: number;
	levelLabel: string;
	tier: PlusHeroTier;
	xp: number;
	levelStartXp: number;
	nextLevelXp: number | null;
	xpToNext: number | null;
	progressPct: number;
	history: HeroHistoryItem[];
	official?: boolean;
};

type OpenDotaHero = {
	id: number;
	name: string;
	localized_name: string;
};

type OpenDotaHeroStat = {
	hero_id: number;
	last_played: number;
	games: number;
	win: number;
};

type OpenDotaRecentMatch = {
	match_id: number;
	hero_id: number;
	kills: number;
	deaths: number;
	assists: number;
	gold_per_min: number;
	xp_per_min: number;
	duration: number;
	start_time: number;
	radiant_win: boolean;
	player_slot: number;
	lane_role?: number;
	is_roaming?: boolean;
	patch?: number;
	version?: number;
};

function steamId64ToAccountId(steamId64: string): number | null {
	try {
		const parsed = BigInt(steamId64);
		if (parsed <= STEAM_ID_64_BASE) return null;
		return Number(parsed - STEAM_ID_64_BASE);
	} catch {
		return null;
	}
}

export function formatRankTier(rankTier: number | null): string {
	if (!rankTier) return 'Нет данных';
	const medal = Math.floor(rankTier / 10);
	const star = rankTier % 10;
	const names: Record<number, string> = {
		1: 'Herald',
		2: 'Guardian',
		3: 'Crusader',
		4: 'Archon',
		5: 'Legend',
		6: 'Ancient',
		7: 'Divine',
		8: 'Immortal'
	};
	const medalName = names[medal] || `Tier ${medal}`;
	return star > 0 ? `${medalName} ${star}` : medalName;
}

function heroImageFromApiName(apiName: string): string {
	// Local verts first (public/heroes); CDN landscape as last resort for missing seeds.
	return localHeroImage(apiName) ?? heroImageCdn(apiName, 'landscape') ?? '';
}

function detectWin(match: { player_slot?: number; radiant_win?: boolean }): boolean {
	const isRadiant = (match.player_slot ?? 0) < 128;
	return Boolean(isRadiant ? match.radiant_win : !match.radiant_win);
}

function roleFromMatch(match: OpenDotaRecentMatch): string {
	if (match.is_roaming) return 'Роум';
	switch (match.lane_role) {
		case 1:
			return 'Легкая линия';
		case 2:
			return 'Центр';
		case 3:
			return 'Сложная линия';
		case 4:
			return 'Лес';
		default:
			return 'Не определена';
	}
}

function patchFromMatch(match: OpenDotaRecentMatch): string {
	const patch = match.patch || match.version;
	if (!patch) return 'Не определен';
	return `Патч ${patch}`;
}

function round1(value: number): number {
	return Math.round(value * 10) / 10;
}

function mapHeroProgress(
	heroStats: OpenDotaHeroStat[],
	heroMap: Map<number, OpenDotaHero>,
	historyByHero: Map<number, HeroHistoryItem[]>,
	limit?: number
): HeroProgress[] {
	const rows = heroStats
		.filter((hero) => hero.games > 0)
		.map((hero) => {
			const heroMeta = heroMap.get(hero.hero_id);
			const plus = plusProgressFromMatches(hero.games, hero.win);
			return {
				heroId: hero.hero_id,
				heroName: heroMeta?.localized_name || `Hero #${hero.hero_id}`,
				heroImage: heroMeta ? heroImageFromApiName(heroMeta.name) : '',
				games: hero.games,
				win: hero.win,
				winRate: hero.games > 0 ? round1((hero.win / hero.games) * 100) : 0,
				lastPlayed: hero.last_played || 0,
				level: plus.level,
				levelLabel: plus.levelLabel,
				tier: plus.tier,
				xp: plus.xp,
				levelStartXp: plus.levelStartXp,
				nextLevelXp: plus.nextLevelXp,
				xpToNext: plus.xpToNext,
				progressPct: plus.progressPct,
				history: (historyByHero.get(hero.hero_id) || []).slice(0, 4)
			};
		})
		.sort((a, b) => b.level - a.level || b.xp - a.xp || b.games - a.games);

	return typeof limit === 'number' ? rows.slice(0, limit) : rows;
}

function toDateLabel(unixSeconds: number): string {
	if (!unixSeconds) return 'Неизвестно';
	const d = new Date(unixSeconds * 1000);
	const dd = String(d.getDate()).padStart(2, '0');
	const mm = String(d.getMonth() + 1).padStart(2, '0');
	return `${dd}.${mm}`;
}

function buildWinrateBuckets(entries: Array<{ label: string; win: boolean }>): WinrateBucket[] {
	const buckets = new Map<string, { games: number; wins: number }>();
	for (const entry of entries) {
		const prev = buckets.get(entry.label) || { games: 0, wins: 0 };
		prev.games += 1;
		if (entry.win) prev.wins += 1;
		buckets.set(entry.label, prev);
	}

	return Array.from(buckets.entries())
		.map(([label, v]) => ({
			label,
			games: v.games,
			wins: v.wins,
			winRate: v.games > 0 ? round1((v.wins / v.games) * 100) : 0
		}))
		.sort((a, b) => b.games - a.games)
		.slice(0, 8);
}

function computeAverages(
	matches: Array<{ kills?: number; deaths?: number; assists?: number; gold_per_min?: number; xp_per_min?: number }>
): DotaAverages | null {
	if (!matches.length) return null;
	const totals = { kills: 0, deaths: 0, assists: 0, gpm: 0, xpm: 0 };
	for (const m of matches) {
		totals.kills += m.kills || 0;
		totals.deaths += m.deaths || 0;
		totals.assists += m.assists || 0;
		totals.gpm += m.gold_per_min || 0;
		totals.xpm += m.xp_per_min || 0;
	}

	const count = matches.length;
	const avgKills = totals.kills / count;
	const avgDeaths = totals.deaths / count;
	const avgAssists = totals.assists / count;
	const avgKda = (avgKills + avgAssists) / Math.max(avgDeaths, 1);

	return {
		kills: round1(avgKills),
		deaths: round1(avgDeaths),
		assists: round1(avgAssists),
		kda: round1(avgKda),
		gpm: round1(totals.gpm / count),
		xpm: round1(totals.xpm / count)
	};
}

export type HeroMatchSample = {
	kills?: number;
	deaths?: number;
	assists?: number;
	gold_per_min?: number;
	xp_per_min?: number;
	player_slot?: number;
	radiant_win?: boolean;
};

export type HeroRecentForm = {
	form: Array<'W' | 'L'>;
	streak: { result: 'W' | 'L'; count: number } | null;
	averages: DotaAverages | null;
};

export function mapHeroRecentForm(matches: HeroMatchSample[]): HeroRecentForm {
	const newestFirst = matches.slice(0, 20);
	const results = newestFirst.map((match) => (detectWin(match) ? 'W' : 'L'));
	let streak: HeroRecentForm['streak'] = null;
	if (results[0]) {
		let count = 0;
		for (const result of results) {
			if (result !== results[0]) break;
			count += 1;
		}
		streak = { result: results[0], count };
	}
	return {
		form: [...results].reverse(),
		streak,
		averages: computeAverages(newestFirst)
	};
}

export async function fetchHeroDetailBySteamId(steamId64: string | null | undefined, heroId: number): Promise<HeroRecentForm | null> {
	if (!steamId64 || !Number.isInteger(heroId) || heroId <= 0) return null;
	const accountId = steamId64ToAccountId(steamId64);
	if (!accountId) return null;
	const { getCachedJson, setCachedJson } = await import('@/server/cache/redis');
	const cacheKey = `od:hero:${accountId}:${heroId}:v2`;
	const cached = await getCachedJson<HeroRecentForm>(cacheKey);
	if (cached) return cached;
	try {
		const signal = AbortSignal.timeout(8000);
		const params = new URLSearchParams({ hero_id: String(heroId), limit: '20' });
		for (const field of ['kills', 'deaths', 'assists', 'gold_per_min', 'xp_per_min', 'player_slot', 'radiant_win']) {
			params.append('project', field);
		}
		const response = await fetch(`https://api.opendota.com/api/players/${accountId}/matches?${params}`, {
			cache: 'no-store',
			signal
		});
		if (!response.ok) return null;
		const matches = (await response.json()) as HeroMatchSample[];
		if (!Array.isArray(matches)) return null;
		const mapped = mapHeroRecentForm(matches);
		await setCachedJson(cacheKey, mapped, 600);
		return mapped;
	} catch {
		return null;
	}
}

export async function fetchOpenDotaRankBySteamId(steamId64: string | null | undefined) {
	if (!steamId64) return null;
	const accountId = steamId64ToAccountId(steamId64);
	if (!accountId) return null;
	try {
		const response = await fetch(`https://api.opendota.com/api/players/${accountId}`, {
			next: { revalidate: 600 },
			signal: AbortSignal.timeout(8000)
		});
		if (!response.ok) return null;
		const player = await response.json();
		const mmr = mmrFromOpenDotaPlayer(player);
		return {
			rankTier: typeof player?.rank_tier === 'number' ? player.rank_tier : null,
			leaderboardRank: typeof player?.leaderboard_rank === 'number' ? player.leaderboard_rank : null,
			mmr: mmr?.value ?? null,
			mmrSource: mmr?.source ?? null
		};
	} catch {
		return null;
	}
}

export async function fetchDotaStatsBySteamId(steamId64: string | null | undefined): Promise<DotaStats | null> {
	if (!steamId64) return null;
	const accountId = steamId64ToAccountId(steamId64);
	if (!accountId) return null;

	try {
		const [playerRes, wlRes] = await Promise.all([
			fetch(`https://api.opendota.com/api/players/${accountId}`, { cache: 'no-store' }),
			fetch(`https://api.opendota.com/api/players/${accountId}/wl`, { cache: 'no-store' })
		]);

		if (!playerRes.ok || !wlRes.ok) return null;

		const player = await playerRes.json();
		const wl = await wlRes.json();
		const win = typeof wl?.win === 'number' ? wl.win : null;
		const lose = typeof wl?.lose === 'number' ? wl.lose : null;
		const total = (win || 0) + (lose || 0);
		const winRate = total > 0 && win !== null ? Number(((win / total) * 100).toFixed(1)) : null;

		return {
			accountId,
			rankTier: typeof player?.rank_tier === 'number' ? player.rank_tier : null,
			leaderboardRank: typeof player?.leaderboard_rank === 'number' ? player.leaderboard_rank : null,
			mmrEstimate:
				typeof player?.computed_mmr === 'number'
					? Math.round(player.computed_mmr)
					: typeof player?.mmr_estimate?.estimate === 'number'
						? player.mmr_estimate.estimate
						: null,
			competitiveRank: typeof player?.competitive_rank === 'number' ? Number(player.competitive_rank) : null,
			soloCompetitiveRank: typeof player?.solo_competitive_rank === 'number' ? Number(player.solo_competitive_rank) : null,
			win,
			lose,
			winRate
		};
	} catch {
		return null;
	}
}

export async function fetchDotaProfileAnalyticsBySteamId(steamId64: string | null | undefined, options: { timeoutMs?: number } = {}): Promise<DotaProfileAnalytics | null> {
	if (!steamId64) return null;
	const accountId = steamId64ToAccountId(steamId64);
	if (!accountId) return null;

	const { getCachedJson, setCachedJson } = await import('@/server/cache/redis');
	const cacheKey = `od:profile:${accountId}`;
	const cached = await getCachedJson<DotaProfileAnalytics>(cacheKey);
	if (cached) return cached;

	try {
		const signal = AbortSignal.timeout(options.timeoutMs ?? 8000);
		const [playerRes, wlRes, heroesRes, recentMatchesRes, constantsRes] = await Promise.all([
			fetch(`https://api.opendota.com/api/players/${accountId}`, { cache: 'no-store', signal }),
			fetch(`https://api.opendota.com/api/players/${accountId}/wl`, { cache: 'no-store', signal }),
			fetch(`https://api.opendota.com/api/players/${accountId}/heroes`, { cache: 'no-store', signal }),
			fetch(`https://api.opendota.com/api/players/${accountId}/recentMatches`, { cache: 'no-store', signal }),
			fetch('https://api.opendota.com/api/heroes', { cache: 'force-cache', signal })
		]);

		if (!playerRes.ok || !wlRes.ok || !heroesRes.ok || !recentMatchesRes.ok || !constantsRes.ok) {
			return null;
		}

		const [player, wl, heroStats, recentMatchesRaw, heroConstants] = await Promise.all([
			playerRes.json(),
			wlRes.json(),
			heroesRes.json() as Promise<OpenDotaHeroStat[]>,
			recentMatchesRes.json() as Promise<OpenDotaRecentMatch[]>,
			constantsRes.json() as Promise<OpenDotaHero[]>
		]);

		const heroMap = new Map<number, OpenDotaHero>();
		for (const hero of heroConstants) {
			heroMap.set(hero.id, hero);
		}

		const recentMatches = (recentMatchesRaw || []).slice(0, 20).map((m) => {
			const heroMeta = heroMap.get(m.hero_id);
			return {
				matchId: m.match_id,
				heroName: heroMeta?.localized_name || `Hero #${m.hero_id}`,
				heroImage: heroMeta ? heroImageFromApiName(heroMeta.name) : '',
				kills: m.kills || 0,
				deaths: m.deaths || 0,
				assists: m.assists || 0,
				gpm: m.gold_per_min || 0,
				xpm: m.xp_per_min || 0,
				durationMinutes: Math.max(1, Math.round((m.duration || 0) / 60)),
				startedAt: m.start_time || 0,
				didWin: detectWin(m),
				role: roleFromMatch(m),
				patchLabel: patchFromMatch(m)
			};
		});

		const topHeroes = (heroStats || [])
			.filter((h) => h.games > 0)
			.sort((a, b) => b.games - a.games)
			.slice(0, 6)
			.map((h) => {
				const heroMeta = heroMap.get(h.hero_id);
				return {
					heroId: h.hero_id,
					heroName: heroMeta?.localized_name || `Hero #${h.hero_id}`,
					heroImage: heroMeta ? heroImageFromApiName(heroMeta.name) : '',
					games: h.games,
					win: h.win,
					winRate: h.games > 0 ? round1((h.win / h.games) * 100) : 0,
					lastPlayed: h.last_played || 0
				};
			});

		const roleWinrates = buildWinrateBuckets(recentMatches.map((m) => ({ label: m.role, win: m.didWin })));
		const patchWinrates = buildWinrateBuckets(recentMatches.map((m) => ({ label: m.patchLabel, win: m.didWin })));
		const averages = computeAverages(recentMatchesRaw || []);

		const historyByHero = new Map<number, HeroHistoryItem[]>();
		const rawByMatchId = new Map<number, OpenDotaRecentMatch>();
		for (const raw of recentMatchesRaw || []) {
			rawByMatchId.set(raw.match_id, raw);
		}
		for (const m of recentMatches) {
			const heroId = rawByMatchId.get(m.matchId)?.hero_id || 0;
			const bucket = historyByHero.get(heroId) || [];
			bucket.push({
				matchId: m.matchId,
				startedAt: m.startedAt,
				result: m.didWin ? 'Выиграл' : 'Проиграл',
				kda: `${m.kills}/${m.deaths}/${m.assists}`,
				role: m.role,
				patchLabel: m.patchLabel
			});
			historyByHero.set(heroId, bucket);
		}

		const allHeroesProgress = mapHeroProgress(heroStats || [], heroMap, historyByHero);
		const heroesProgress = allHeroesProgress.slice(0, 12);

		const roleBuckets = new Map<string, { games: number; wins: number }>();
		for (const m of recentMatches) {
			const prev = roleBuckets.get(m.role) || { games: 0, wins: 0 };
			prev.games += 1;
			if (m.didWin) prev.wins += 1;
			roleBuckets.set(m.role, prev);
		}
		const favoriteRoles: FavoriteRole[] = Array.from(roleBuckets.entries())
			.map(([role, v]) => ({
				role,
				games: v.games,
				wins: v.wins,
				pickRate: recentMatches.length > 0 ? round1((v.games / recentMatches.length) * 100) : 0,
				winRate: v.games > 0 ? round1((v.wins / v.games) * 100) : 0
			}))
			.sort((a, b) => b.games - a.games);

		const chronological = [...recentMatches].reverse();
		let cumulative = 0;
		const formTrend: FormTrendPoint[] = chronological.map((m, idx) => {
			cumulative += m.didWin ? 1 : -1;
			return {
				index: idx,
				matchId: m.matchId,
				didWin: m.didWin,
				cumulative,
				dateLabel: toDateLabel(m.startedAt)
			};
		});

		const win = typeof wl?.win === 'number' ? wl.win : null;
		const lose = typeof wl?.lose === 'number' ? wl.lose : null;
		const total = (win || 0) + (lose || 0);
		const winRate = total > 0 && win !== null ? Number(((win / total) * 100).toFixed(1)) : null;

		const hasPublicMatchData = recentMatches.length > 0 || topHeroes.length > 0;
		const hasPrivateHistory = Boolean(player?.profile?.fh_unavailable);

		const analytics: DotaProfileAnalytics = {
			source: 'OpenDota',
			fetchedAt: new Date().toISOString(),
			accountId,
			rankTier: typeof player?.rank_tier === 'number' ? player.rank_tier : null,
			leaderboardRank: typeof player?.leaderboard_rank === 'number' ? player.leaderboard_rank : null,
			mmrEstimate:
				typeof player?.computed_mmr === 'number'
					? Math.round(player.computed_mmr)
					: typeof player?.mmr_estimate?.estimate === 'number'
						? player.mmr_estimate.estimate
						: null,
			competitiveRank: typeof player?.competitive_rank === 'number' ? Number(player.competitive_rank) : null,
			soloCompetitiveRank: typeof player?.solo_competitive_rank === 'number' ? Number(player.solo_competitive_rank) : null,
			win,
			lose,
			winRate,
			hasPublicMatchData,
			hasPrivateHistory,
			isDotaPlus: Boolean(player?.profile?.plus ?? player?.plus),
			topHeroes,
			heroesProgress,
			allHeroesProgress,
			recentMatches,
			favoriteRoles,
			formTrend,
			roleWinrates,
			patchWinrates,
			averages
		};
		await setCachedJson(cacheKey, analytics, 600);
		return analytics;
	} catch {
		return null;
	}
}
