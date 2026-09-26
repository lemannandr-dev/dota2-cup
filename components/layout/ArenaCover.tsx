import type { CSSProperties, ReactNode } from 'react';
import { preload } from 'react-dom';
import { DEFAULT_SITE_APPEARANCE, type SiteAppearance } from '@/lib/site-appearance';

const DEFAULT_COVER_SRCSET = '/brand/dota2-heroes-828.webp 828w, /brand/dota2-heroes-1280.webp 1280w, /brand/dota2-heroes.webp 1600w';
const DEFAULT_COVER_SIZES = '100vw';

function coverSources(url: string) {
	if (url === DEFAULT_SITE_APPEARANCE.homeCoverUrl || url.startsWith('/brand/dota2-heroes')) {
		return {
			src: '/brand/dota2-heroes-828.webp',
			srcSet: DEFAULT_COVER_SRCSET,
			sizes: DEFAULT_COVER_SIZES
		};
	}
	return { src: url, srcSet: undefined, sizes: undefined };
}

export function ArenaCover({
	appearance,
	compact = false,
	landing = false,
	stage = false,
	preloadArt = false,
	children
}: {
	appearance: SiteAppearance;
	compact?: boolean;
	landing?: boolean;
	stage?: boolean;
	preloadArt?: boolean;
	children?: ReactNode;
}) {
	const Title = landing ? 'h1' : 'p';
	const cover = coverSources(appearance.homeCoverUrl);
	const logoSrc =
		appearance.dotaLogoUrl === DEFAULT_SITE_APPEARANCE.dotaLogoUrl || appearance.dotaLogoUrl.endsWith('dota2-logo-symbol.png')
			? '/dota2-logo-symbol-64.png'
			: appearance.dotaLogoUrl;

	if (preloadArt) {
		preload(cover.src, {
			as: 'image',
			imageSrcSet: cover.srcSet,
			imageSizes: cover.sizes,
			fetchPriority: 'high'
		});
	}

	return (
		<section
			className={`arena-cover ${compact ? 'is-compact' : ''} ${landing ? 'is-landing' : ''} ${stage ? 'is-stage' : ''} ${appearance.motionEnabled ? 'is-moving' : ''}`}
			aria-label="Aegis Arena, турниры Dota 2"
			style={{ '--cover-position-y': `${appearance.backdropPositionY}%` } as CSSProperties}
		>
			{/* Native img keeps LCP in the first HTML paint (no client Image boundary). */}
			{/* eslint-disable-next-line @next/next/no-img-element */}
			<img
				className="arena-cover-art"
				src={cover.src}
				srcSet={cover.srcSet}
				sizes={cover.sizes}
				alt="Герои Dota 2"
				fetchPriority="high"
				decoding="async"
				width={828}
				height={268}
			/>
			<div className="arena-cover-content">
				<div className="arena-cover-game">
					{/* eslint-disable-next-line @next/next/no-img-element */}
					<img src={logoSrc} alt="" width={32} height={32} decoding="async" />
					<span>DOTA 2</span>
					<span className="arena-cover-divider" />
					<span>5 VS 5</span>
				</div>
				{stage ? null : (
					<>
						<Title className="arena-cover-title">AEGIS ARENA</Title>
						<p className="arena-cover-subtitle">Твоя команда. Твоя арена.</p>
					</>
				)}
				{children}
			</div>
		</section>
	);
}
