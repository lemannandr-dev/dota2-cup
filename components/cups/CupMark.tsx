import type { Championship } from '@/lib/champions';
import { cupCardTitle } from '@/lib/cup-label';
import { CupGlyph } from '@/components/cups/DotaTrophy3D';
import { aegisAwardOf } from '@/lib/aegis-awards';

export { CupGlyph } from '@/components/cups/DotaTrophy3D';

type CupMarkCup = Pick<Championship, 'tournamentId' | 'href' | 'year' | 'title' | 'engraving' | 'showcase' | 'dryRun'> & {
	description?: string;
	winnerTeamName?: string;
	trophy?: Pick<Championship['trophy'], 'award'>;
};

export function CupMark({
	cup,
	size = 'sm'
}: {
	cup: CupMarkCup;
	size?: 'icon' | 'xs' | 'sm' | 'md';
}) {
	const compact = size !== 'md';
	const kind = cup.showcase ? 'Витрина' : cup.dryRun ? 'Прогон' : 'Чемпион';
	const title = cupCardTitle(cup.title);
	const award = 'trophy' in cup && cup.trophy?.award ? cup.trophy.award : aegisAwardOf('ember');
	const hint = [kind, award.name, String(cup.year), title, cup.description || cup.engraving].filter(Boolean).join(' · ');

	if (size === 'icon') {
		return (
			<a
				href={cup.href}
				data-cup-mark={cup.tournamentId}
				aria-label={`История: ${hint}`}
				className="group relative inline-flex h-9 w-7 shrink-0 items-end justify-center rounded-md hover:bg-[#C9A227]/10"
			>
				<CupGlyph year={cup.year} title={cup.title} accent={award.id} compact className="h-8 w-5" />
				<span className="pointer-events-none absolute bottom-full left-0 z-30 mb-2 hidden w-56 rounded-lg border border-[#C9A227]/40 bg-[#140c18] px-2.5 py-2 text-left shadow-[0_8px_24px_rgba(0,0,0,0.45)] group-hover:block group-focus-visible:block">
					<span className="block text-[10px] uppercase tracking-[0.14em] text-[#F8E7A0]/80">
						{kind} {cup.year}
					</span>
					<span className="mt-0.5 block text-xs font-semibold text-cream">{title}</span>
					<span className="mt-1 block text-[11px] leading-4 text-muted">{cup.description || cup.engraving}</span>
					<span className="mt-1.5 block text-[10px] text-[#C9A227]/80">История турнира</span>
				</span>
			</a>
		);
	}

	return (
		<a
			href={cup.href}
			data-cup-mark={cup.tournamentId}
			className={`group relative inline-flex items-center border border-[#C9A227]/40 bg-[#1a1024]/70 hover:border-[#F8E7A0]/70 ${
				size === 'xs'
					? 'h-[3.625rem] w-full gap-2 overflow-hidden rounded-lg px-1.5'
					: size === 'sm'
						? 'gap-3 rounded-xl px-2 py-1.5'
						: 'gap-3 rounded-xl px-3 py-2'
			}`}
		>
			<span className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_20%_40%,rgba(201,162,39,0.16),transparent_55%)]" />
			<CupGlyph
				year={cup.year}
				title={cup.title}
				accent={award.id}
				compact={compact}
				className={size === 'xs' ? 'h-12 w-8 shrink-0' : size === 'sm' ? 'h-[7.25rem] w-20' : 'h-28 w-20'}
			/>
			<span className="relative min-w-0 overflow-hidden">
				{size === 'xs' ? (
					<>
						<span className="block truncate text-[10px] uppercase tracking-[0.14em] text-[#F8E7A0]/80">
							{kind} {cup.year}
						</span>
						<span className="block truncate text-xs text-cream">{title}</span>
					</>
				) : (
					<>
						<span className="block text-[10px] uppercase tracking-[0.18em] text-[#F8E7A0]/80">
							{kind} {cup.year}
						</span>
						<span className={`block truncate font-display text-cream ${size === 'sm' ? 'text-xs' : 'text-sm'}`}>{title}</span>
						{size === 'md' && <span className="block truncate text-[11px] text-muted">Гравировка: {cup.engraving}</span>}
					</>
				)}
			</span>
		</a>
	);
}
