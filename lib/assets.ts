// Central manifest of external prototype assets.
// Publicly reachable does not mean unrestricted commercial licensing:
// production requires a Valve/OpenDota rights review or original artwork.

export const rankMedalBases = {
	herald: 'https://www.opendota.com/assets/images/dota2/rank_icons/rank_icon_1.png',
	guardian: 'https://www.opendota.com/assets/images/dota2/rank_icons/rank_icon_2.png',
	crusader: 'https://www.opendota.com/assets/images/dota2/rank_icons/rank_icon_3.png',
	archon: 'https://www.opendota.com/assets/images/dota2/rank_icons/rank_icon_4.png',
	legend: 'https://www.opendota.com/assets/images/dota2/rank_icons/rank_icon_5.png',
	ancient: 'https://www.opendota.com/assets/images/dota2/rank_icons/rank_icon_6.png',
	divine: 'https://www.opendota.com/assets/images/dota2/rank_icons/rank_icon_7.png',
	immortal: 'https://www.opendota.com/assets/images/dota2/rank_icons/rank_icon_8.png'
} as const;

export type RankTier = keyof typeof rankMedalBases;

export const rankStars = {
	1: 'https://www.opendota.com/assets/images/dota2/rank_icons/rank_star_1.png',
	2: 'https://www.opendota.com/assets/images/dota2/rank_icons/rank_star_2.png',
	3: 'https://www.opendota.com/assets/images/dota2/rank_icons/rank_star_3.png',
	4: 'https://www.opendota.com/assets/images/dota2/rank_icons/rank_star_4.png',
	5: 'https://www.opendota.com/assets/images/dota2/rank_icons/rank_star_5.png'
} as const;

export type RankStars = keyof typeof rankStars;

export const rankLabels: Record<RankTier, string> = {
	herald: 'Рекрут',
	guardian: 'Страж',
	crusader: 'Рыцарь',
	archon: 'Герой',
	legend: 'Легенда',
	ancient: 'Властелин',
	divine: 'Божество',
	immortal: 'Титан'
};

const heroCdn = 'https://cdn.cloudflare.steamstatic.com/apps/dota2/images/dota_react/heroes';

export const heroPortraits = {
	axe: `${heroCdn}/axe.png`,
	invoker: `${heroCdn}/invoker.png`,
	phantomAssassin: `${heroCdn}/phantom_assassin.png`,
	crystalMaiden: `${heroCdn}/crystal_maiden.png`,
	juggernaut: `${heroCdn}/juggernaut.png`
} as const;

export type HeroKey = keyof typeof heroPortraits;

export const heroLabels: Record<HeroKey, string> = {
	axe: 'Axe',
	invoker: 'Invoker',
	phantomAssassin: 'Phantom Assassin',
	crystalMaiden: 'Crystal Maiden',
	juggernaut: 'Juggernaut'
};

export function romanStars(stars: number): string {
	const map = ['', 'I', 'II', 'III', 'IV', 'V'];
	return map[stars] || '';
}
