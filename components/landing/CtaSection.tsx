import React from 'react';
import Link from 'next/link';
import { SteamButton } from '@/components/dota/SteamButton';

export function CtaSection() {
	return (
		<section id="organizers" className="relative overflow-hidden py-24 md:py-32 scroll-mt-20">
			<div
				aria-hidden="true"
				className="absolute inset-0 pointer-events-none"
				style={{
					background:
						'radial-gradient(55% 55% at 50% 100%, rgba(216,168,78,0.12), transparent 70%)'
				}}
			/>
			<svg
				aria-hidden="true"
				className="absolute inset-0 w-full h-full pointer-events-none opacity-20"
				viewBox="0 0 1200 400"
				preserveAspectRatio="none"
			>
				<g stroke="#25303D" strokeWidth="2" fill="none">
					<path d="M0 80 h280 v120 h240" />
					<path d="M0 320 h280 v-120" />
					<path d="M520 200 h240 v-60 h440" stroke="#D8A84E" />
					<path d="M760 140 v120 h440" />
				</g>
			</svg>

			<div className="max-w-shell mx-auto px-4 md:px-6 lg:px-10 relative text-center">
				<p className="text-xs tracking-[0.3em] text-aegis font-mono mb-5">
					ВАША СЛЕДУЮЩАЯ ИГРА НАЧИНАЕТСЯ ЗДЕСЬ
				</p>
				<h2 className="font-display font-bold uppercase text-4xl md:text-6xl text-cream leading-tight">
					Пять игроков.
					<br />
					Одна сетка.
				</h2>
				<p className="mt-5 text-muted max-w-xl mx-auto">
					Соберите подтверждённый состав или откройте регистрацию на собственный турнир.
				</p>
				<div className="mt-9 flex flex-wrap justify-center gap-3">
					<a
						href="#tournaments"
						className="px-6 py-3 rounded-lg bg-aegis text-ink font-semibold hover:bg-aegisSoft transition-colors"
					>
						Найти турнир
					</a>
					<Link
						href="/tournaments"
						className="px-6 py-3 rounded-lg border border-line text-cream hover:border-aegis/50 transition-colors"
					>
						Создать турнир
					</Link>
					<SteamButton variant="secondary" />
				</div>
			</div>
		</section>
	);
}
