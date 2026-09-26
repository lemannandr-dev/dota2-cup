'use client';

import { useState } from 'react';
import Image from 'next/image';
import { heroImage, heroImageCdn, heroSlugFromSrc } from '@/lib/hero-image';
import { MediaSkeleton } from '@/components/ui/MediaSkeleton';

type Props = {
	src: string;
	alt: string;
	width: number;
	height: number;
	className?: string;
};

/** Profile/recap hero thumb: local vert first, CDN fallback, skeleton until load. */
export function HeroMedia({ src, alt, width, height, className = 'h-8 w-14 rounded object-cover' }: Props) {
	const slug = heroSlugFromSrc(src);
	const local = slug ? heroImage(slug, 'vert') : src.startsWith('/') ? src : null;
	const cdn = slug ? heroImageCdn(`npc_dota_hero_${slug}`, 'landscape') : src.startsWith('http') ? src : null;
	const initial = local || src;
	const [current, setCurrent] = useState(initial);
	const [remote, setRemote] = useState(!initial.startsWith('/'));
	const [loaded, setLoaded] = useState(false);

	return (
		<span className="relative inline-block shrink-0" style={{ width, height }}>
			{!loaded ? <MediaSkeleton className="absolute inset-0 h-full w-full rounded" label={alt} /> : null}
			<Image
				src={current}
				alt={alt}
				width={width}
				height={height}
				unoptimized={remote}
				className={`${className} ${loaded ? 'opacity-100' : 'opacity-0'} transition-opacity duration-200`}
				onLoad={() => setLoaded(true)}
				onError={() => {
					if (cdn && current !== cdn) {
						setLoaded(false);
						setRemote(true);
						setCurrent(cdn);
					}
				}}
			/>
		</span>
	);
}
