'use client';

import { useMemo, useState } from 'react';
import type { CupHighlight } from '@/lib/cup-highlights';
import { twitchHighlightSrc } from '@/lib/cup-highlights';

export function CupHighlights({ items }: { items: CupHighlight[] }) {
	const [activeId, setActiveId] = useState(items[0]?.id ?? '');
	const parent = typeof window !== 'undefined' ? window.location.hostname : 'localhost';
	const active = items.find((row) => row.id === activeId) ?? items[0];
	const embed = useMemo(() => {
		if (!active) return null;
		if (active.kind === 'youtube') return active.embed;
		if (active.kind === 'twitch') return twitchHighlightSrc(active.url, parent);
		return null;
	}, [active, parent]);

	if (!items.length) {
		return (
			<div className="flex min-h-[12rem] flex-col justify-center rounded-xl border border-dashed border-line bg-black/20 px-4 py-6 text-sm text-muted md:min-h-[14rem]">
				<p className="font-medium text-cream/80">Лучшие моменты</p>
				<p className="mt-2 leading-5">
					Пока без клипов: организатор ещё не добавил ссылки YouTube, Twitch или Kick.
				</p>
			</div>
		);
	}

	return (
		<div className="space-y-2">
			<p className="text-[10px] uppercase tracking-[0.18em] text-[#F8E7A0]/80">Лучшие моменты</p>
			{items.length > 1 && (
				<div className="flex flex-wrap gap-1.5">
					{items.map((row) => (
						<button
							key={row.id}
							type="button"
							onClick={() => setActiveId(row.id)}
							className={`rounded-full px-2.5 py-1 text-[11px] ${
								active?.id === row.id ? 'bg-[#C9A227] text-ink' : 'border border-line text-muted'
							}`}
						>
							{row.label}
						</button>
					))}
				</div>
			)}
			<div className="relative aspect-video overflow-hidden rounded-xl bg-black">
				{embed ? (
					<iframe
						title={active.label}
						src={embed}
						className="absolute inset-0 h-full w-full"
						allow="encrypted-media; picture-in-picture"
						allowFullScreen
					/>
				) : (
					<a
						href={active.url}
						target="_blank"
						rel="noreferrer"
						className="absolute inset-0 flex flex-col items-center justify-center gap-2 px-4 text-center text-sm text-cream hover:bg-white/5"
					>
						<span>{active.label}</span>
						<span className="text-xs text-aegisSoft">Открыть на площадке</span>
					</a>
				)}
			</div>
		</div>
	);
}
