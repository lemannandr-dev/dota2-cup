import './globals.css';
import React from 'react';
import type { Metadata, Viewport } from 'next';
import { Inter, Unbounded } from 'next/font/google';
import { Header } from '@/components/layout/Header';
import { Footer } from '@/components/layout/Footer';
import { SiteChrome } from '@/components/layout/SiteChrome';
import { PlayerTabBar } from '@/components/layout/PlayerTabBar';
import { getCurrentSteamUser } from '@/server/auth/session';
import { isStandAdmin } from '@/lib/stand-admin';
import { SITE_NAME, defaultDescription, siteUrl } from '@/lib/site';
import { ServiceWorkerRegistration } from '@/components/pwa/ServiceWorkerRegistration';
import { PushOptIn } from '@/components/pwa/PushOptIn';
import { LobbyMentionPing } from '@/components/lobby/LobbyMentionPing';
import { ToastProvider } from '@/components/ui/ToastProvider';
import { OfflineQueueProvider } from '@/components/offline/OfflineQueueProvider';
import { ArenaVisualLayer } from '@/components/layout/ArenaVisualLayer';
import { getSiteAppearance } from '@/server/site-appearance';
import { storedOpenDotaMmr, storedRankOf } from '@/lib/dota-rank';
import { resolveOpenDotaSnapshot } from '@/server/opendota-rank';

const inter = Inter({
	subsets: ['latin', 'cyrillic'],
	variable: '--font-sans',
	display: 'swap',
	adjustFontFallback: true
});

const unbounded = Unbounded({
	subsets: ['latin', 'cyrillic'],
	weight: ['700', '800'],
	variable: '--font-display',
	display: 'swap',
	adjustFontFallback: true,
	preload: true
});

export const metadata: Metadata = {
	metadataBase: new URL(siteUrl()),
	applicationName: SITE_NAME,
	title: {
		default: `${SITE_NAME} — турнирная платформа Dota 2`,
		template: `%s — ${SITE_NAME}`
	},
	description: defaultDescription,
	manifest: '/manifest.webmanifest',
	icons: {
		icon: [
			{ url: '/icons/dota2-tab-32.png', sizes: '32x32', type: 'image/png' },
			{ url: '/icons/dota2-tab-48.png', sizes: '48x48', type: 'image/png' },
			{ url: '/icons/dota2-tab-192.png', sizes: '192x192', type: 'image/png' }
		],
		apple: [{ url: '/icons/dota2-tab-180.png', sizes: '180x180', type: 'image/png' }],
		shortcut: '/icons/dota2-tab-32.png'
	},
	appleWebApp: {
		capable: true,
		title: SITE_NAME,
		statusBarStyle: 'black-translucent'
	},
	formatDetection: {
		telephone: false
	},
	alternates: { canonical: '/' },
	openGraph: {
		type: 'website',
		locale: 'ru_RU',
		siteName: SITE_NAME,
		title: `${SITE_NAME} — турнирная платформа Dota 2`,
		description: defaultDescription,
		url: siteUrl()
	},
	twitter: {
		card: 'summary_large_image',
		title: `${SITE_NAME} — турнирная платформа Dota 2`,
		description: defaultDescription
	},
	robots: {
		index: true,
		follow: true
	}
};

export const viewport: Viewport = {
	width: 'device-width',
	initialScale: 1,
	viewportFit: 'cover',
	themeColor: '#06080C'
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
	const lang = process.env.NEXT_PUBLIC_DEFAULT_LOCALE || 'ru';
	const [user, appearance] = await Promise.all([getCurrentSteamUser(), getSiteAppearance()]);
	const rankSnapshot = user?.steamId
		? await resolveOpenDotaSnapshot(
				user.steamId,
				storedRankOf(user),
				storedOpenDotaMmr(user.openDotaMmr, user.openDotaMmrSource)
			)
		: { medal: null, mmr: null };
	return (
		<html lang={lang} className={`${inter.variable} ${unbounded.variable}`}>
			<body className="bg-ink text-cream font-sans tactical-grid">
				<ToastProvider>
					<OfflineQueueProvider>
					<ServiceWorkerRegistration />
					<ArenaVisualLayer appearance={appearance} />
					<div className="grain-overlay" aria-hidden="true" />
					<SiteChrome>
						<Header
							user={
								user
									? {
											id: user.id,
											displayName: user.displayName,
											avatarUrl: user.avatarUrl,
											medal: rankSnapshot.medal,
											mmr: rankSnapshot.mmr ?? storedOpenDotaMmr(user.openDotaMmr, user.openDotaMmrSource)
										}
									: null
							}
							appLogoUrl={appearance.appLogoUrl}
						/>
					</SiteChrome>
					<div className="mobile-app-content">{children}</div>
					<PlayerTabBar userId={user?.id ?? null} isAdmin={user ? isStandAdmin(user) : false} />
					{user ? <PushOptIn /> : null}
					{user?.steamId ? <LobbyMentionPing /> : null}
					<SiteChrome dock="footer">
						<Footer />
					</SiteChrome>
					</OfflineQueueProvider>
				</ToastProvider>
			</body>
		</html>
	);
}
