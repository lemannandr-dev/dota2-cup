import Link from 'next/link';
import { ArrowRight, UsersRound } from 'lucide-react';
import { ArenaCover } from '@/components/layout/ArenaCover';
import type { SiteAppearance } from '@/lib/site-appearance';

export function HeroSection({ appearance }: { appearance: SiteAppearance }) {
	return (
		<ArenaCover appearance={appearance} landing preloadArt>
			<p className="max-w-lg text-sm leading-6 text-white/90">Собери пятёрку и выходи на турниры Dota 2.</p>
			<div className="mt-3 flex flex-wrap gap-3">
				<Link href="/tournaments" className="aegis-action inline-flex min-h-12 items-center gap-2 rounded-lg bg-aegis px-4 text-sm font-semibold text-ink hover:bg-aegisSoft">
					Найти турнир<ArrowRight size={18} aria-hidden="true" />
					</Link>
				<Link href="/party-search" className="aegis-action inline-flex min-h-12 items-center gap-2 rounded-lg border border-white/40 bg-ink/60 px-4 text-sm font-semibold text-white hover:bg-ink/80">
					<UsersRound size={18} aria-hidden="true" />Найти пати
				</Link>
			</div>
		</ArenaCover>
	);
}
