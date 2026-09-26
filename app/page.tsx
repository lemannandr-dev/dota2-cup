import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { AnalyticsSection } from '@/components/landing/AnalyticsSection';
import { CtaSection } from '@/components/landing/CtaSection';
import { HeroSection } from '@/components/landing/HeroSection';
import { HowArenaWorks } from '@/components/landing/HowArenaWorks';
import { PlayersSection } from '@/components/landing/PlayersSection';
import { SecuritySection } from '@/components/landing/SecuritySection';
import { TournamentsSection } from '@/components/landing/TournamentsSection';
import { JsonLd } from '@/components/seo/JsonLd';
import { arenaFaq, faqJsonLd, organizationJsonLd, softwareJsonLd, websiteJsonLd } from '@/lib/seo-jsonld';
import { getCurrentSteamUser } from '@/server/auth/session';
import { loadLandingPreview } from '@/server/landing/preview';
import { defaultDescription } from '@/lib/site';
import { getSiteAppearance } from '@/server/site-appearance';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
	title: 'Турнирная платформа для пятёрок Dota 2',
	description: defaultDescription,
	alternates: { canonical: '/' }
};

export default async function HomePage() {
	const sessionUser = await getCurrentSteamUser();
	if (sessionUser) redirect('/home');
	const appearance = await getSiteAppearance();
	const preview = await loadLandingPreview().catch(() => ({
		tournaments: [],
		bracket: [],
		players: [],
		rosters: []
	}));

	return (
		<main>
			<JsonLd data={[organizationJsonLd(), websiteJsonLd(), softwareJsonLd(), faqJsonLd(arenaFaq)]} />
			<HeroSection appearance={appearance} />
			<HowArenaWorks />
			<TournamentsSection tournaments={preview.tournaments} bracket={preview.bracket} />
			<PlayersSection players={preview.players} rosters={preview.rosters} />
			<AnalyticsSection />
			<SecuritySection />
			<CtaSection />
		</main>
	);
}
