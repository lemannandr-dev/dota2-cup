'use client';

import { useState } from 'react';
import Image from 'next/image';
import { heroImage, heroImageCdn } from '@/lib/hero-image';
import { MediaSkeleton } from '@/components/ui/MediaSkeleton';

type Props = {
	apiName: string;
	alt: string;
	className?: string;
	width?: number;
	height?: number;
	priority?: boolean;
};

/** Local-first hero vert with CDN fallback and skeleton until load. */
export function HeroThumb({ apiName, alt, className = 'h-full w-full object-cover', width = 128, height = 164, priority }: Props) {
	const local = heroImage(apiName, 'vert');
	const cdn = heroImageCdn(apiName, 'vert');
	const [src, setSrc] = useState(local ?? cdn ?? '');
	const [remote, setRemote] = useState(!local && Boolean(cdn));
	const [loaded, setLoaded] = useState(false);

	if (!src) {
		return <MediaSkeleton className="h-full w-full" label={alt} />;
	}

	return (
		<span className="relative block h-full w-full">
			{!loaded ? <MediaSkeleton className="absolute inset-0 h-full w-full" label={alt} /> : null}
			<Image
				src={src}
				alt={alt}
				width={width}
				height={height}
				priority={priority}
				unoptimized={remote}
				className={`${className} ${loaded ? 'opacity-100' : 'opacity-0'} transition-opacity duration-200`}
				loading={priority ? undefined : 'lazy'}
				onLoad={() => setLoaded(true)}
				onError={() => {
					if (cdn && src !== cdn) {
						setLoaded(false);
						setRemote(true);
						setSrc(cdn);
					}
				}}
			/>
		</span>
	);
}
