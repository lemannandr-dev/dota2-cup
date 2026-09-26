'use client';

import React, { useMemo, useState } from 'react';
import Link from 'next/link';
import { filterLandingTournaments, type LandingBracketMatch, type LandingPrizeKind, type LandingTournament } from '@/lib/landing-live';
import { StatusPill } from '@/components/dota/StatusPill';

function prizePill(kind: LandingPrizeKind) {
	if (kind === 'confirmed') return <StatusPill tone="aegis">Фонд на эскроу</StatusPill>;
	if (kind === 'unconfirmed') return <StatusPill tone="info">Фонд не зарезервирован</StatusPill>;
	return <StatusPill tone="muted">Без фонда</StatusPill>;
}

export function TournamentsSection({
	tournaments,
	bracket
}: {
	tournaments: LandingTournament[];
	bracket: LandingBracketMatch[];
}) {
	const regions = useMemo(() => ['Все', ...Array.from(new Set(tournaments.map((row) => row.region)))], [tournaments]);
	const [region, setRegion] = useState('Все');
	const [prize, setPrize] = useState<'any' | LandingPrizeKind>('any');
	const visible = useMemo(() => filterLandingTournaments(tournaments, region, prize), [tournaments, region, prize]);

	return (
		<section id="tournaments" className="max-w-shell mx-auto px-4 md:px-6 lg:px-10 py-20 md:py-28 scroll-mt-20">
			<p className="text-xs tracking-[0.3em] text-aegis font-mono mb-4">ЖИВЫЕ ТУРНИРЫ</p>
			<h2 className="font-display font-bold uppercase text-3xl md:text-5xl text-cream leading-tight">
				Выберите свою
				<br />
				турнирную линию
			</h2>
			<p className="mt-4 text-muted max-w-2xl">
				Карточки с арены, не демо. Фонд — только если орга его зарезервировал. Сетка — пары с карточки турнира.
			</p>

			<div className="mt-8 flex flex-wrap gap-2">
				{regions.map((item) => (
					<button
						key={item}
						type="button"
						onClick={() => setRegion(item)}
						aria-pressed={region === item}
						className={`px-4 py-2 rounded-full text-sm border transition-colors min-h-[44px] ${
							region === item ? 'border-aegis text-aegisSoft bg-aegis/10' : 'border-line text-muted hover:text-cream'
						}`}
					>
						{item}
					</button>
				))}
				<span className="w-px bg-line mx-1 hidden md:block" aria-hidden="true" />
				{(
					[
						['any', 'Любой фонд'],
						['confirmed', 'Фонд на эскроу'],
						['unconfirmed', 'Не зарезервирован'],
						['none', 'Без фонда']
					] as const
				).map(([key, label]) => (
					<button
						key={key}
						type="button"
						onClick={() => setPrize(key)}
						aria-pressed={prize === key}
						className={`px-4 py-2 rounded-full text-sm border transition-colors min-h-[44px] ${
							prize === key ? 'border-aegis text-aegisSoft bg-aegis/10' : 'border-line text-muted hover:text-cream'
						}`}
					>
						{label}
					</button>
				))}
			</div>

			<div className="mt-8 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
				{visible.map((row) => (
					<article key={row.id} className="obsidian-glass rounded-card p-6 card-hover flex flex-col gap-4">
						<div className="flex items-center justify-between gap-2">
							<StatusPill tone="radiant">{row.statusLabel}</StatusPill>
							<span className="font-mono text-xs text-muted">{row.startLabel}</span>
						</div>
						<div>
							<h3 className="font-display text-xl text-cream">{row.title}</h3>
							<p className="text-sm text-muted mt-1">
								{row.formatLabel} · {row.series}
							</p>
						</div>
						<dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
							<div>
								<dt className="text-muted text-xs">Регион</dt>
								<dd className="text-cream">{row.region}</dd>
							</div>
							<div>
								<dt className="text-muted text-xs">Ранг</dt>
								<dd className="text-cream">{row.rankCap}</dd>
							</div>
							<div>
								<dt className="text-muted text-xs">Заявки</dt>
								<dd className="font-mono text-cream">
									{row.teams} / {row.maxTeams}
								</dd>
							</div>
							<div>
								<dt className="text-muted text-xs">Приз</dt>
								<dd className="font-mono text-aegisSoft">{row.prizeLabel}</dd>
							</div>
						</dl>
						{prizePill(row.prizeKind)}
						<Link href={row.href} className="mt-auto text-center px-4 py-2.5 rounded-lg border border-line text-cream hover:border-aegis/60 transition-colors">
							Открыть карточку
						</Link>
					</article>
				))}
				{visible.length === 0 && (
					<div className="col-span-full text-center text-muted py-12 border border-dashed border-line rounded-card">
						Живых турниров по фильтру нет.{' '}
						<Link href="/tournaments" className="text-aegisSoft hover:text-aegis">
							Все турниры
						</Link>
					</div>
				)}
			</div>

			<div className="mt-12">
				<h3 className="font-display text-lg text-cream mb-4">Пары с арены</h3>
				{bracket.length === 0 ? (
					<p className="text-sm text-muted">
						Открытых пар пока нет. Сетка появится на карточке турнира, не здесь как картинка.
					</p>
				) : (
					<div className="overflow-x-auto pb-2 -mx-4 px-4">
						<div className="flex gap-4 min-w-[720px]">
							{bracket.map((match) => (
								<a key={match.id} href={match.href} className="obsidian-glass rounded-xl p-4 w-56 shrink-0 hover:border-aegis/40">
									<div className="flex items-center justify-between text-[11px] text-muted mb-3">
										<span>{match.roundLabel}</span>
										<span className="font-mono">BO{match.bestOf}</span>
									</div>
									<div className="flex justify-between items-center px-3 py-2 rounded-lg mb-1.5 text-sm border border-line/60 text-cream">
										<span>{match.teamA}</span>
										<span className="font-mono">{match.scoreA}</span>
									</div>
									<div className="flex justify-between items-center px-3 py-2 rounded-lg text-sm border border-line/60 text-cream">
										<span>{match.teamB}</span>
										<span className="font-mono">{match.scoreB}</span>
									</div>
									{match.live && (
										<div className="mt-2 text-[11px] text-radiant">● Идёт на арене</div>
									)}
								</a>
							))}
						</div>
					</div>
				)}
			</div>
		</section>
	);
}
