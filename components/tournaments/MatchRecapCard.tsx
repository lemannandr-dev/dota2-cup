import Image from 'next/image';
import type { MatchRecap } from '@/lib/match-recap';

export function MatchRecapCard({ recap }: { recap: MatchRecap }) {
	return (
		<div className={`space-y-1 rounded-lg border px-3 py-2 ${recap.won ? 'border-aegis/40 bg-aegis/10' : 'border-line bg-black/20'}`}>
			<div className="text-xs uppercase tracking-wide text-aegisSoft">После катки</div>
			<div className="text-sm text-cream">
				{recap.yourTeam}
				{recap.opponent ? ` — ${recap.opponent}` : ''} · {recap.scoreLabel} · {recap.ratingLabel}
			</div>
			<p className="text-sm text-cream">{recap.nextHint}</p>
			{recap.abilityIcons && recap.abilityIcons.length > 0 ? (
				<ul className="flex flex-wrap gap-1.5 pt-1" aria-label="Способности в рекапе">
					{recap.abilityIcons.map((icon) => (
						<li key={icon.id}>
							<Image
								src={icon.src}
								alt={icon.name ?? icon.id}
								width={32}
								height={32}
								unoptimized
								className="h-8 w-8 rounded border border-line/60 bg-black/40 object-cover"
							/>
						</li>
					))}
				</ul>
			) : null}
			<p className="text-xs text-muted">{recap.plusHint}</p>
		</div>
	);
}
