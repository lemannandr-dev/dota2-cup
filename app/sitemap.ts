import type { MetadataRoute } from 'next';
import { prisma } from '@/lib/prisma';
import { absoluteUrl } from '@/lib/site';

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
	const now = new Date();
	const staticPages: MetadataRoute.Sitemap = [
		{ url: absoluteUrl('/'), lastModified: now, changeFrequency: 'daily', priority: 1 },
		{ url: absoluteUrl('/about'), lastModified: now, changeFrequency: 'monthly', priority: 0.8 },
		{ url: absoluteUrl('/legal'), lastModified: now, changeFrequency: 'yearly', priority: 0.3 },
		{ url: absoluteUrl('/tournaments'), lastModified: now, changeFrequency: 'hourly', priority: 0.9 },
		{ url: absoluteUrl('/players'), lastModified: now, changeFrequency: 'daily', priority: 0.7 },
		{ url: absoluteUrl('/teams'), lastModified: now, changeFrequency: 'daily', priority: 0.7 },
		{ url: absoluteUrl('/party-search'), lastModified: now, changeFrequency: 'daily', priority: 0.6 },
		{ url: absoluteUrl('/heroes'), lastModified: now, changeFrequency: 'weekly', priority: 0.4 }
	];

	const cups = await prisma.tournament
		.findMany({
			where: { status: { in: ['REGISTRATION', 'CHECK_IN', 'LIVE', 'FINISHED'] } },
			select: { id: true, updatedAt: true, status: true },
			take: 200,
			orderBy: { updatedAt: 'desc' }
		})
		.catch(() => []);

	const cupPages = cups.flatMap((cup) => {
		const pages: MetadataRoute.Sitemap = [
			{
				url: absoluteUrl(`/tournaments/${cup.id}`),
				lastModified: cup.updatedAt,
				changeFrequency: cup.status === 'FINISHED' ? 'monthly' : 'hourly',
				priority: cup.status === 'LIVE' ? 0.8 : 0.6
			}
		];
		if (cup.status === 'FINISHED') {
			pages.push({
				url: absoluteUrl(`/tournaments/${cup.id}/cup`),
				lastModified: cup.updatedAt,
				changeFrequency: 'monthly',
				priority: 0.5
			});
		}
		return pages;
	});

	return [...staticPages, ...cupPages];
}
