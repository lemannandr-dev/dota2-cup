/**
 * Optional download of Steam hero verticals → public/heroes/*_vert.webp
 * Requires network + sharp. Safe to skip if assets already vendored.
 *
 * Usage: node scripts/fetch-hero-verts.mjs
 */
import { mkdir, writeFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const OUT = path.join(process.cwd(), 'public', 'heroes');
const CDN = 'https://cdn.cloudflare.steamstatic.com/apps/dota2/images/heroes';

/** Minimal seed list — expand via OpenDota heroes.json when needed. */
const SEED = [
	'abaddon', 'alchemist', 'ancient_apparition', 'antimage', 'arc_warden', 'axe', 'bane', 'batrider', 'beastmaster',
	'bloodseeker', 'bounty_hunter', 'brewmaster', 'bristleback', 'broodmother', 'centaur', 'chaos_knight', 'chen',
	'clinkz', 'rattletrap', 'crystal_maiden', 'dark_seer', 'dark_willow', 'dawnbreaker', 'dazzle', 'death_prophet',
	'disruptor', 'doom_bringer', 'dragon_knight', 'drow_ranger', 'earth_spirit', 'earthshaker', 'elder_titan',
	'ember_spirit', 'enchantress', 'enigma', 'faceless_void', 'grimstroke', 'gyrocopter', 'hoodwink', 'huskar',
	'invoker', 'jakiro', 'juggernaut', 'keeper_of_the_light', 'kunkka', 'legion_commander', 'leshrac', 'lich',
	'life_stealer', 'lina', 'lion', 'lone_druid', 'luna', 'lycan', 'magnataur', 'marci', 'mars', 'medusa', 'meepo',
	'mirana', 'monkey_king', 'morphling', 'muerta', 'naga_siren', 'furion', 'necrolyte', 'night_stalker', 'nyx_assassin',
	'ogre_magi', 'omniknight', 'oracle', 'obsidian_destroyer', 'pangolier', 'phantom_assassin', 'phantom_lancer',
	'phoenix', 'primal_beast', 'puck', 'pudge', 'pugna', 'queenofpain', 'razor', 'riki', 'ringmaster', 'rubick',
	'sand_king', 'shadow_demon', 'nevermore', 'shadow_shaman', 'silencer', 'skywrath_mage', 'slardar', 'slark',
	'snapfire', 'sniper', 'spectre', 'spirit_breaker', 'storm_spirit', 'sven', 'techies', 'templar_assassin',
	'terrorblade', 'tidehunter', 'shredder', 'tinker', 'tiny', 'treant', 'troll_warlord', 'tusk', 'abyssal_underlord',
	'undying', 'ursa', 'vengefulspirit', 'venomancer', 'viper', 'visage', 'void_spirit', 'warlock', 'weaver',
	'windrunner', 'winter_wyvern', 'witch_doctor', 'wisp', 'skeleton_king', 'kez', 'largo', 'zuus'
];

async function main() {
	await mkdir(OUT, { recursive: true });
	let sharp = null;
	try {
		sharp = require('sharp');
	} catch {
		console.warn('sharp not installed — writing jpg copies only');
	}

	for (const slug of SEED) {
		const destWebp = path.join(OUT, `${slug}_vert.webp`);
		try {
			const meta = await stat(destWebp);
			if (meta.size > 1000) {
				console.log('skip', slug);
				continue;
			}
		} catch {
			/* missing */
		}
		const url = `${CDN}/${slug}_vert.jpg`;
		const res = await fetch(url);
		if (!res.ok) {
			console.warn('fail', slug, res.status);
			continue;
		}
		const buf = Buffer.from(await res.arrayBuffer());
		if (sharp) {
			await sharp(buf).webp({ quality: 82 }).toFile(destWebp);
			console.log('webp', slug);
		} else {
			await writeFile(path.join(OUT, `${slug}_vert.jpg`), buf);
			console.log('jpg', slug);
		}
	}
}

main().catch((err) => {
	console.error(err);
	process.exit(1);
});
