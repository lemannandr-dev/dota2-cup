import https from 'node:https';
import fs from 'node:fs';
import path from 'node:path';

const outDir = path.resolve('public/atmosphere');
fs.mkdirSync(outDir, { recursive: true });

const files = [
	{
		out: 'stone.jpg',
		url: 'https://upload.wikimedia.org/wikipedia/commons/5/58/Grey_dry_stone_barren_terrain_seamless_ground_texture.jpg'
	},
	{
		out: 'granite.jpg',
		url: 'https://upload.wikimedia.org/wikipedia/commons/3/3b/Light_grey_granite_rock_seamless_stone_surface_texture.jpg'
	},
	{
		out: 'bronze.jpg',
		url: 'https://upload.wikimedia.org/wikipedia/commons/f/f3/Sculpture_bronze_texture.jpg',
		alt: 'http://www.public-domain-image.com/public-domain-images-pictures-free-stock-photos/textures-and-patterns-public-domain-images-pictures/metal-texture-public-domain-images-pictures/sculpture-bronze-texture.jpg'
	},
	{
		out: 'hearth.jpg',
		url: 'https://upload.wikimedia.org/wikipedia/commons/1/16/Dark_brown_firewood_texture_%28Unsplash_kFxWDfj0pD8%29.jpg'
	}
];

function get(url) {
	return new Promise((resolve, reject) => {
		const req = https.get(
			url,
			{
				headers: {
					'User-Agent': 'AegisArena/1.0 (local build; atmosphere CC0 cache)',
					Accept: 'image/jpeg,image/*,*/*'
				}
			},
			(res) => {
				if (res.statusCode && res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
					res.resume();
					get(res.headers.location).then(resolve, reject);
					return;
				}
				if (res.statusCode !== 200) {
					reject(new Error(`${url} -> ${res.statusCode}`));
					res.resume();
					return;
				}
				const chunks = [];
				res.on('data', (c) => chunks.push(c));
				res.on('end', () => resolve(Buffer.concat(chunks)));
			}
		);
		req.on('error', reject);
	});
}

function sleep(ms) {
	return new Promise((r) => setTimeout(r, ms));
}

for (const file of files) {
	const dest = path.join(outDir, file.out);
	try {
		const buf = await get(file.url);
		if (buf.length < 10_000) throw new Error(`too small ${buf.length}`);
		fs.writeFileSync(dest, buf);
		console.log('OK', file.out, buf.length);
	} catch (err) {
		console.error('FAIL', file.out, String(err.message || err));
		if (file.alt) {
			try {
				await sleep(2000);
				const buf = await get(file.alt.replace(/^http:/, 'https:'));
				if (buf.length < 10_000) throw new Error(`alt too small ${buf.length}`);
				fs.writeFileSync(dest, buf);
				console.log('OK alt', file.out, buf.length);
			} catch (altErr) {
				console.error('FAIL alt', file.out, String(altErr.message || altErr));
			}
		}
	}
	await sleep(8000);
}
