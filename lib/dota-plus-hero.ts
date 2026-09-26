// Official Dota Plus hero leveling: https://dota2.fandom.com/wiki/Dota_Plus
// Match XP only: 50 for a game, +50 for a win. Challenges/relics are not in OpenDota.

export type PlusHeroTier = 'bronze' | 'silver' | 'gold' | 'platinum' | 'master' | 'grandmaster';

export const PLUS_MATCH_XP = 50;
export const PLUS_WIN_BONUS_XP = 50;

/** Cumulative XP required to complete this level (reach the next one). Index = level. */
export const PLUS_LEVEL_TOTAL_XP = [
	0, 50, 350, 750, 1250, 1850, 2750, 3750, 4850, 6050, 7350, 8750, 10450, 12250, 14150, 16150, 18250, 20450, 22950, 25550,
	28250, 31050, 33950, 36950, 40050, 46850, 50850, 55050, 59450, 64050, 72050
] as const;

export const PLUS_TIER_LABELS: Record<PlusHeroTier, string> = {
	bronze: 'Бронза',
	silver: 'Серебро',
	gold: 'Золото',
	platinum: 'Платина',
	master: 'Мастер',
	grandmaster: 'Грандмастер'
};

export const PLUS_TIER_BADGES: Record<PlusHeroTier, string> = {
	bronze: 'https://static.wikia.nocookie.net/dota2_gamepedia/images/f/f3/Plus_Hero_Badge_1.png',
	silver: 'https://static.wikia.nocookie.net/dota2_gamepedia/images/8/88/Plus_Hero_Badge_2.png',
	gold: 'https://static.wikia.nocookie.net/dota2_gamepedia/images/b/b1/Plus_Hero_Badge_3.png',
	platinum: 'https://static.wikia.nocookie.net/dota2_gamepedia/images/d/d4/Plus_Hero_Badge_4.png',
	master: 'https://static.wikia.nocookie.net/dota2_gamepedia/images/5/59/Plus_Hero_Badge_5.png',
	grandmaster: 'https://static.wikia.nocookie.net/dota2_gamepedia/images/5/5b/Plus_Hero_Badge_6.png'
};

export function plusTierFromLevel(level: number): PlusHeroTier {
	if (level >= 30) return 'grandmaster';
	if (level >= 25) return 'master';
	if (level >= 18) return 'platinum';
	if (level >= 12) return 'gold';
	if (level >= 6) return 'silver';
	return 'bronze';
}

export function plusXpFromMatches(games: number, wins: number): number {
	const safeGames = Math.max(0, games);
	const safeWins = Math.max(0, Math.min(wins, safeGames));
	return safeGames * PLUS_MATCH_XP + safeWins * PLUS_WIN_BONUS_XP;
}

export function plusProgressFromXp(xp: number, officialLevel?: number) {
	const safeXp = Math.max(0, Math.floor(xp));
	if (safeXp <= 0 && !officialLevel) {
		return {
			level: 0,
			levelLabel: 'Нет прогресса',
			tier: 'bronze' as PlusHeroTier,
			xp: 0,
			levelStartXp: 0,
			nextLevelXp: PLUS_LEVEL_TOTAL_XP[1],
			xpToNext: PLUS_LEVEL_TOTAL_XP[1],
			progressPct: 0
		};
	}

	let level = 1;
	for (let next = 1; next < PLUS_LEVEL_TOTAL_XP.length; next += 1) {
		if (safeXp >= PLUS_LEVEL_TOTAL_XP[next]) level = next;
		else break;
	}
	if (officialLevel && officialLevel >= 1 && officialLevel <= 30) {
		level = officialLevel;
	}

	const tier = plusTierFromLevel(level);
	const levelStartXp = PLUS_LEVEL_TOTAL_XP[level] ?? 0;
	const nextLevelXp = level >= 30 ? null : PLUS_LEVEL_TOTAL_XP[level + 1];
	const span = nextLevelXp === null ? 1 : Math.max(1, nextLevelXp - levelStartXp);
	const intoLevel = nextLevelXp === null ? span : Math.max(0, safeXp - levelStartXp);
	const progressPct = nextLevelXp === null ? 100 : Math.min(100, Math.round((intoLevel / span) * 1000) / 10);

	return {
		level,
		levelLabel: PLUS_TIER_LABELS[tier],
		tier,
		xp: safeXp,
		levelStartXp,
		nextLevelXp,
		xpToNext: nextLevelXp === null ? null : Math.max(0, nextLevelXp - safeXp),
		progressPct
	};
}

export function plusProgressFromMatches(games: number, wins: number) {
	const xp = plusXpFromMatches(games, wins);
	if (games <= 0 || xp <= 0) {
		return {
			level: 0,
			levelLabel: 'Нет прогресса',
			tier: 'bronze' as PlusHeroTier,
			xp: 0,
			levelStartXp: 0,
			nextLevelXp: PLUS_LEVEL_TOTAL_XP[1],
			xpToNext: PLUS_LEVEL_TOTAL_XP[1],
			progressPct: 0
		};
	}

	let level = 1;
	for (let next = 1; next < PLUS_LEVEL_TOTAL_XP.length; next += 1) {
		if (xp >= PLUS_LEVEL_TOTAL_XP[next]) level = next;
		else break;
	}

	const tier = plusTierFromLevel(level);
	const levelStartXp = PLUS_LEVEL_TOTAL_XP[level];
	const nextLevelXp = level >= 30 ? null : PLUS_LEVEL_TOTAL_XP[level + 1];
	const span = nextLevelXp === null ? 1 : Math.max(1, nextLevelXp - levelStartXp);
	const intoLevel = nextLevelXp === null ? span : Math.max(0, xp - levelStartXp);
	const progressPct = nextLevelXp === null ? 100 : Math.min(100, Math.round((intoLevel / span) * 1000) / 10);

	return {
		level,
		levelLabel: PLUS_TIER_LABELS[tier],
		tier,
		xp,
		levelStartXp,
		nextLevelXp,
		xpToNext: nextLevelXp === null ? null : Math.max(0, nextLevelXp - xp),
		progressPct
	};
}
