'use client';

import { useState } from 'react';

const TRUSTED_LOGO_HOST = /(steamstatic\.com|cloudflare\.steamstatic\.com|imgur\.com|i\.imgur\.com|localhost|127\.0\.0\.1|minio|amazonaws\.com|googleusercontent\.com|discordapp\.com|discordcdn\.com)$/i;

function logoLooksLoadable(url: string) {
	if (url.startsWith('/api/media/')) return true;
	if (url.startsWith('/') && !url.startsWith('//')) return true;
	try {
		const parsed = new URL(url);
		if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') return false;
		return TRUSTED_LOGO_HOST.test(parsed.hostname) || parsed.hostname.endsWith('.steamstatic.com');
	} catch {
		return false;
	}
}

/** Team crest with initials fallback when hotlink/CDN fails. */
export function TeamLogo({
	url,
	name,
	size = 44,
	className = 'h-11 w-11 rounded-lg border border-line'
}: {
	url?: string | null;
	name: string;
	size?: number;
	className?: string;
}) {
	const usable = Boolean(url && logoLooksLoadable(url));
	const [failed, setFailed] = useState(false);
	const initials = name.trim().slice(0, 2).toUpperCase() || '?';
	const mark = size >= 56 ? 'text-xl' : 'text-sm';

	if (!usable || failed) {
		return (
			<div
				className={`flex shrink-0 items-center justify-center bg-panel2 font-display text-aegis ${mark} ${className}`}
				aria-hidden="true"
			>
				{initials}
			</div>
		);
	}

	return (
		// Native img: Next/Image often skips onError for dead hotlinks.
		// eslint-disable-next-line @next/next/no-img-element
		<img
			key={url!}
			src={url!}
			alt={name}
			width={size}
			height={size}
			referrerPolicy="no-referrer"
			decoding="async"
			className={`shrink-0 object-cover ${className}`}
			onError={() => setFailed(true)}
		/>
	);
}
