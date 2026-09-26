'use client';

import { usePathname } from 'next/navigation';
import type { CSSProperties } from 'react';
import { DEFAULT_SITE_APPEARANCE, type SiteAppearance } from '@/lib/site-appearance';

const HIDDEN_PREFIXES = ['/overlay', '/admin'];
const HIDDEN_EXACT = new Set(['/', '/home', '/tournaments', '/party-search', '/teams', '/heroes', '/players', '/balance', '/login', '/register']);

function backdropSrc(url: string) {
	if (url === DEFAULT_SITE_APPEARANCE.mobileBackdropUrl || url.startsWith('/brand/dota2-scene')) {
		return '/brand/dota2-scene-900.webp';
	}
	return url;
}

export function ArenaVisualLayer({ appearance }: { appearance: SiteAppearance }) {
	const path = usePathname() || '';
	if (HIDDEN_EXACT.has(path) || HIDDEN_PREFIXES.some((prefix) => path.startsWith(prefix))) return null;

	const style = {
		'--arena-backdrop-opacity': `${appearance.backdropOpacity / 100}`,
		'--arena-backdrop-position-y': `${appearance.backdropPositionY}%`
	} as CSSProperties;

	return (
		<div className={`arena-visual-layer ${appearance.motionEnabled ? 'is-moving' : ''}`} style={style} aria-hidden="true">
			{/* eslint-disable-next-line @next/next/no-img-element */}
			<img
				src={backdropSrc(appearance.mobileBackdropUrl)}
				alt=""
				className="arena-backdrop-image"
				loading="lazy"
				decoding="async"
				fetchPriority="low"
				width={900}
				height={1600}
			/>
		</div>
	);
}
