export const ATMOSPHERE_TONES = ['stone', 'granite', 'bronze', 'hearth', 'void'] as const;
export type AtmosphereTone = (typeof ATMOSPHERE_TONES)[number];

export type AtmosphereAsset = {
	id: AtmosphereTone;
	path: string | null;
	licensePage: string;
	license: 'CC0' | 'PD' | 'css';
	pages: string[];
	note: string;
};

/** Local washes only — no Valve heroes, no TI Aegis, no hotlink. */
export const ATMOSPHERE_ASSETS: AtmosphereAsset[] = [
	{
		id: 'stone',
		path: '/atmosphere/stone.jpg',
		licensePage: 'https://commons.wikimedia.org/wiki/File:Grey_dry_stone_barren_terrain_seamless_ground_texture.jpg',
		license: 'CC0',
		pages: ['/', '/about', '/tournaments', '/home'],
		note: 'Grey dry stone barren terrain — Sisters.seamless, CC0 1.0'
	},
	{
		id: 'granite',
		path: '/atmosphere/granite.jpg',
		licensePage: 'https://commons.wikimedia.org/wiki/File:Light_grey_granite_rock_seamless_stone_surface_texture.jpg',
		license: 'CC0',
		pages: ['/heroes', '/players'],
		note: 'Light grey granite rock — Sisters.seamless, CC0 1.0'
	},
	{
		id: 'bronze',
		path: '/atmosphere/bronze.jpg',
		licensePage: 'https://commons.wikimedia.org/wiki/File:Sculpture_bronze_texture.jpg',
		license: 'PD',
		pages: ['/balance'],
		note: 'Sculpture bronze texture — Titus Tscharntke, public domain'
	},
	{
		id: 'hearth',
		path: '/atmosphere/hearth.jpg',
		licensePage: 'https://commons.wikimedia.org/wiki/File:Dark_brown_firewood_texture_(Unsplash_kFxWDfj0pD8).jpg',
		license: 'CC0',
		pages: ['/party-search', '/teams'],
		note: 'Dark brown firewood (Unsplash pre-2017-06-05 on Commons) — CC0 1.0'
	},
	{
		id: 'void',
		path: null,
		licensePage: '',
		license: 'css',
		pages: ['/about'],
		note: 'CSS gradient #0b1020 → violet — no NASA file; void/night awards stay CupGlyph only'
	}
];
