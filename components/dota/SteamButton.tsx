'use client';

import React from 'react';
import { steamLoginHref } from '@/lib/auth-return';

interface Props {
	variant?: 'primary' | 'secondary';
	className?: string;
	label?: string;
	next?: string;
}

function SteamIcon() {
	return (
		<svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor" aria-hidden="true">
			<path d="M12 2C6.8 2 2.5 5.9 2 11l5.4 2.2c.5-.3 1-.5 1.6-.5h.2l2.4-3.5v-.1c0-2.1 1.7-3.8 3.8-3.8s3.8 1.7 3.8 3.8-1.7 3.8-3.8 3.8h-.1l-3.4 2.4v.2c0 1.6-1.3 2.9-2.9 2.9-1.4 0-2.6-1-2.8-2.4L2.3 14.5C3.5 18.9 7.4 22 12 22c5.5 0 10-4.5 10-10S17.5 2 12 2zm-5.7 14.2l1.2.5c.2.8 1 1.4 1.9 1.4 1.1 0 1.9-.9 1.9-1.9S10.5 14.2 9.4 14.2h-.2l-1.3-.5c.3-.5.9-.8 1.5-.8 1.1 0 2 .9 2 2s-.9 2-2 2c-.8 0-1.5-.5-1.8-1.2l-1.3-.5zm9.1-4.7c-1.4 0-2.5-1.1-2.5-2.5s1.1-2.5 2.5-2.5 2.5 1.1 2.5 2.5-1.1 2.5-2.5 2.5zm0-4.4c-1 0-1.9.8-1.9 1.9s.8 1.9 1.9 1.9 1.9-.8 1.9-1.9-.9-1.9-1.9-1.9z" />
		</svg>
	);
}

export function SteamButton({ variant = 'primary', className = '', label = 'Войти через Steam', next }: Props) {
	const styles =
		variant === 'primary'
			? 'bg-aegis text-ink hover:bg-aegisSoft'
			: 'bg-panel2 text-cream border border-line hover:border-aegis/50';
	return (
		<a
			href={steamLoginHref(next)}
			onClick={(event) => {
				if (next) return;
				event.currentTarget.href = steamLoginHref(`${window.location.pathname}${window.location.search}${window.location.hash}`);
			}}
			className={`inline-flex min-h-11 items-center gap-2 rounded-lg px-5 py-2.5 text-sm font-semibold transition-colors ${styles} ${className}`}
		>
			<SteamIcon />
			{label}
		</a>
	);
}
