'use client';

import { useState } from 'react';
import Image from 'next/image';
import { MediaSkeleton } from '@/components/ui/MediaSkeleton';

export function SteamAvatar({
	url,
	name,
	className = 'h-8 w-8'
}: {
	url?: string | null;
	name: string;
	className?: string;
}) {
	const [failed, setFailed] = useState(false);
	const [loaded, setLoaded] = useState(false);
	const letter = (name.trim()[0] || '?').toUpperCase();
	if (!url || failed) {
		return (
			<div className={`flex items-center justify-center rounded-full bg-aegis/20 text-xs font-bold text-aegis ${className}`}>
				{letter}
			</div>
		);
	}
	return (
		<span className={`relative inline-block overflow-hidden rounded-full ${className}`}>
			{!loaded ? <MediaSkeleton className="absolute inset-0 h-full w-full rounded-full" label={name} /> : null}
			<Image
				src={url}
				alt={name}
				width={32}
				height={32}
				unoptimized
				className={`h-full w-full rounded-full object-cover ${loaded ? 'opacity-100' : 'opacity-0'} transition-opacity duration-200`}
				referrerPolicy="no-referrer"
				onLoad={() => setLoaded(true)}
				onError={() => setFailed(true)}
			/>
		</span>
	);
}
