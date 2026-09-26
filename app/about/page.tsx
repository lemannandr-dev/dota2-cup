import type { Metadata } from 'next';
import { AboutDesk } from '@/components/about/AboutDesk';
import { JsonLd } from '@/components/seo/JsonLd';
import { arenaFaq, faqJsonLd, organizationJsonLd } from '@/lib/seo-jsonld';
import { loadAboutBoard } from '@/server/about/board';
import { defaultDescription } from '@/lib/site';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
	title: 'О проекте',
	description: defaultDescription,
	alternates: { canonical: '/about' }
};

export default async function AboutPage() {
	const { cups, bracket } = await loadAboutBoard();
	return (
		<>
			<JsonLd data={[organizationJsonLd(), faqJsonLd(arenaFaq)]} />
			<AboutDesk cups={cups} bracket={bracket} />
		</>
	);
}
