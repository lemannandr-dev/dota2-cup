'use client';

import { useEffect, useState } from 'react';

function formatRemain(ms: number) {
	const total = Math.max(0, Math.floor(ms / 1000));
	const days = Math.floor(total / 86400);
	const hours = Math.floor((total % 86400) / 3600);
	const minutes = Math.floor((total % 3600) / 60);
	const seconds = total % 60;
	if (days > 0) return `${days}д ${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
	if (hours > 0) return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
	return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

/** Large live countdown for mobile match-day / home urgency (mock-aligned). */
export function LiveCountdown({
	iso,
	ended = 'Сейчас',
	size = 'md',
	pulseUnder = 120_000
}: {
	iso: string;
	ended?: string;
	size?: 'sm' | 'md' | 'lg';
	/** Pulse when fewer than this many ms remain. */
	pulseUnder?: number;
}) {
	const [now, setNow] = useState<number | null>(null);
	useEffect(() => {
		setNow(Date.now());
		const timer = window.setInterval(() => setNow(Date.now()), 1000);
		return () => window.clearInterval(timer);
	}, []);

	const type =
		size === 'lg' ? 'font-display text-4xl tracking-tight' : size === 'sm' ? 'font-mono text-base' : 'font-display text-2xl';

	if (now === null) {
		return <span className={`${type} tabular-nums text-aegisSoft`}>—:—</span>;
	}

	const left = Date.parse(iso) - now;
	if (Number.isNaN(left) || left <= 0) {
		return <span className={`${type} font-semibold text-radiant`}>{ended}</span>;
	}

	const urgent = left <= pulseUnder;
	return (
		<span
			className={`${type} tabular-nums ${urgent ? 'mobile-timer-urgent text-[#FF8A5C]' : 'text-cream'}`}
			aria-live="polite"
		>
			{formatRemain(left)}
		</span>
	);
}
