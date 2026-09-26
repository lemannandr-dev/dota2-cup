import { aboutRoundLabel, schematicEightBracket, type AboutBracketPair, type AboutBracketStory } from '@/lib/about-arena';

function PairCard({
	teamA,
	teamB,
	scoreA,
	scoreB,
	live,
	done,
	href
}: {
	teamA: string;
	teamB: string;
	scoreA: number | null;
	scoreB: number | null;
	live: boolean;
	done: boolean;
	href?: string;
}) {
	const body = (
		<div
			className={`w-44 shrink-0 rounded-xl border px-3 py-2 ${
				live ? 'border-radiant/50 bg-radiant/5' : done ? 'border-aegis/30 bg-panel/50' : 'border-line bg-panel/30'
			}`}
		>
			<div className="flex items-center justify-between gap-2 text-sm">
				<span className="min-w-0 truncate text-cream">{teamA}</span>
				<span className="tabular-nums text-muted">{scoreA ?? '—'}</span>
			</div>
			<div className="mt-1 flex items-center justify-between gap-2 text-sm">
				<span className="min-w-0 truncate text-cream">{teamB}</span>
				<span className="tabular-nums text-muted">{scoreB ?? '—'}</span>
			</div>
			{live && <p className="mt-1 text-[10px] text-radiant">идёт на арене</p>}
		</div>
	);
	if (href) {
		return (
			<a href={href} className="block hover:border-aegis">
				{body}
			</a>
		);
	}
	return body;
}

function RoundStrip({ rounds }: { rounds: AboutBracketPair[][] }) {
	const lastRound = rounds[rounds.length - 1]?.[0]?.round ?? 1;
	return (
		<div className="-mx-1 overflow-x-auto pb-2">
			<div className="flex min-w-[42rem] items-start gap-4 px-1">
				{rounds.map((pairs) => {
					const round = pairs[0]?.round ?? 1;
					return (
						<div key={round} className="flex min-w-[11.5rem] flex-1 flex-col gap-3">
							<p className="text-[10px] uppercase tracking-[0.16em] text-aegisSoft">{aboutRoundLabel(round, lastRound)}</p>
							<div className="flex flex-col justify-around gap-3">
								{pairs.map((pair) => (
									<PairCard key={pair.id} {...pair} />
								))}
							</div>
						</div>
					);
				})}
			</div>
		</div>
	);
}

export function AboutBracket({ story }: { story: AboutBracketStory }) {
	const teach = schematicEightBracket();
	const live = story.source === 'schematic' ? null : story;

	return (
		<section id="bracket" className="scroll-mt-24 space-y-4">
			<div>
				<p className="font-mono text-[11px] uppercase tracking-[0.18em] text-aegisSoft">Турнирная сетка</p>
				<h2 className="mt-2 font-display text-2xl text-cream md:text-3xl">От посева до кубка</h2>
				<p className="mt-2 max-w-3xl text-sm leading-6 text-muted">
					Олимпийка на восемь: посев 1 играет с 8, дальше полуфинал и финал. Проигравший выходит. Это схема, не
					выдуманные чемпионы.
				</p>
			</div>
			<div className="obsidian-glass rounded-card p-4 md:p-5">
				<div>
					<p className="mb-2 text-[10px] uppercase tracking-[0.16em] text-muted">Как выглядит сетка</p>
					<RoundStrip rounds={teach.rounds} />
				</div>
				{live && (
					<div className="mt-6 border-t border-line/50 pt-4">
						<p className="mb-2 text-[10px] uppercase tracking-[0.16em] text-aegisSoft">
							{live.source === 'live' ? 'Сейчас на арене' : 'Последний закрытый кубок'} · {live.cupTitle}
						</p>
						<RoundStrip rounds={live.rounds} />
						{live.href && (
							<p className="mt-3 text-sm">
								<a href={live.href} className="text-aegisSoft hover:text-aegis">
									Открыть сетку на карточке турнира
								</a>
							</p>
						)}
					</div>
				)}
			</div>
		</section>
	);
}
