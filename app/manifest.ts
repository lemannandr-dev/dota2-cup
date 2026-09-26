import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
	return {
		id: '/',
		name: 'Aegis Arena',
		short_name: 'Aegis',
		description: 'Турниры Dota 2 для игроков и организаторов.',
		start_url: '/home',
		scope: '/',
		display: 'standalone',
		background_color: '#06080C',
		theme_color: '#06080C',
		categories: ['sports', 'entertainment'],
		icons: [
			{
				src: '/icons/aegis-arena-192.png',
				sizes: '192x192',
				type: 'image/png',
				purpose: 'any'
			},
			{
				src: '/icons/aegis-arena-512.png',
				sizes: '512x512',
				type: 'image/png',
				purpose: 'any'
			},
			{
				src: '/icons/aegis-arena-512.png',
				sizes: '512x512',
				type: 'image/png',
				purpose: 'maskable'
			}
		]
	};
}
