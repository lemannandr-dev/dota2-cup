'use client';

import { useEffect, useRef, useState } from 'react';
import { DOTA_COVER_SLIDES } from '@/lib/dota-cover-slides';

const INTERVAL_MS = 9000;

export function ArenaCoverSlides() {
	const [index, setIndex] = useState(0);
	const [paused, setPaused] = useState(false);
	const [reduceMotion, setReduceMotion] = useState(false);
	const failed = useRef(new Set<number>());
	const count = DOTA_COVER_SLIDES.length;

	useEffect(() => {
		const media = window.matchMedia('(prefers-reduced-motion: reduce)');
		const sync = () => setReduceMotion(media.matches);
		sync();
		media.addEventListener('change', sync);
		return () => media.removeEventListener('change', sync);
	}, []);

	useEffect(() => {
		if (paused || reduceMotion) return;
		const timer = window.setInterval(() => {
			if (document.visibilityState === 'hidden') return;
			setIndex((current) => (current + 1) % count);
		}, INTERVAL_MS);
		return () => window.clearInterval(timer);
	}, [paused, reduceMotion, count]);

	const slide = DOTA_COVER_SLIDES[index];
	const previous = (index - 1 + count) % count;
	const next = (index + 1) % count;

	function go(target: number) {
		setIndex((target + count) % count);
	}

	return (
		<>
			{DOTA_COVER_SLIDES.map((item, itemIndex) => {
				const nearby = itemIndex === index || itemIndex === next || itemIndex === previous;
				if (!nearby) return null;
				return (
					// Native img: these are remote 4K files, not the local LCP cover.
					// eslint-disable-next-line @next/next/no-img-element
					<img
						key={item.src}
						className={`arena-cover-slide${itemIndex === index ? ' is-active' : ''}`}
						src={item.src}
						alt={itemIndex === index ? item.alt : ''}
						width={3840}
						height={2160}
						decoding="async"
						fetchPriority={itemIndex === 0 ? 'high' : 'low'}
						onError={() => {
							failed.current.add(itemIndex);
							if (failed.current.size >= count || itemIndex !== index) return;
							go(index + 1);
						}}
					/>
				);
			})}
			<div
				className="arena-slide-bar"
				onMouseEnter={() => setPaused(true)}
				onMouseLeave={() => setPaused(false)}
				onFocus={() => setPaused(true)}
				onBlur={() => setPaused(false)}
			>
				<button type="button" className="arena-slide-nav" aria-label="Предыдущий кадр" onClick={() => go(index - 1)}>
					‹
				</button>
				<div className="arena-slide-copy">
					<p className="arena-slide-kicker">Dota 2 · 4K</p>
					<p className="arena-slide-title" aria-live="polite">
						{slide.title}
						<span className="arena-slide-line">{slide.line}</span>
					</p>
				</div>
				<div className="arena-slide-dots" role="tablist" aria-label="Кадры Dota 2">
					{DOTA_COVER_SLIDES.map((item, itemIndex) => (
						<button
							key={item.src}
							type="button"
							role="tab"
							aria-label={item.title}
							aria-selected={itemIndex === index}
							className={itemIndex === index ? 'is-active' : ''}
							onClick={() => go(itemIndex)}
						/>
					))}
				</div>
				<button type="button" className="arena-slide-nav" aria-label="Следующий кадр" onClick={() => go(index + 1)}>
					›
				</button>
			</div>
		</>
	);
}
