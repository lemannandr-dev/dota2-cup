'use client';

import React, { useMemo, useState } from 'react';
import Image from 'next/image';
import type { HeroProgress } from '@/lib/dota-stats';
import { PLUS_TIER_BADGES, PLUS_TIER_LABELS, type PlusHeroTier } from '@/lib/dota-plus-hero';
import { HeroThumb } from '@/components/heroes/HeroThumb';
import { HeroDataCard } from '@/components/heroes/HeroDataCard';

export type CatalogHero = {
	id: number;
	name: string;
	localizedName: string;
	primaryAttr: string;
	attackType: string;
	roles: string[];
};

const attributeSections = [
	{ key: 'str', label: 'Сила', marker: 'bg-red-500', text: 'text-red-300' },
	{ key: 'agi', label: 'Ловкость', marker: 'bg-emerald-500', text: 'text-emerald-300' },
	{ key: 'int', label: 'Интеллект', marker: 'bg-sky-500', text: 'text-sky-300' },
	{ key: 'all', label: 'Универсальность', marker: 'bg-violet-500', text: 'text-violet-300' }
] as const;

const attributeLabels: Record<string, string> = {
	str: 'Сила',
	agi: 'Ловкость',
	int: 'Интеллект',
	all: 'Универсальный'
};

const tierFrame: Record<PlusHeroTier, string> = {
	bronze: 'border-[#b08a5c]/70 shadow-[0_0_12px_rgba(176,138,92,0.25)]',
	silver: 'border-slate-200/70 shadow-[0_0_12px_rgba(226,232,240,0.2)]',
	gold: 'border-aegis shadow-[0_0_14px_rgba(216,168,78,0.35)]',
	platinum: 'border-cyan-200/80 shadow-[0_0_14px_rgba(165,243,252,0.28)]',
	master: 'border-fuchsia-300 shadow-[0_0_16px_rgba(240,171,252,0.32)]',
	grandmaster: 'border-amber-200 shadow-[0_0_18px_rgba(253,230,138,0.45)]'
};

function PlusBadge({ tier, level }: { tier: PlusHeroTier; level: number }) {
	return (
		<div className="absolute left-1/2 top-1 z-10 flex -translate-x-1/2 flex-col items-center" title={`${PLUS_TIER_LABELS[tier]} · уровень ${level}`}>
			<Image src={PLUS_TIER_BADGES[tier]} alt="" width={40} height={40} unoptimized className="h-10 w-10 object-contain drop-shadow-lg" />
			<span className="-mt-0.5 rounded bg-black/80 px-1.5 font-mono text-[11px] font-bold leading-none text-cream">{level}</span>
		</div>
	);
}

export function HeroesCatalog({
	heroes,
	progress,
	source = 'estimate',
	signedIn = false
}: {
	heroes: CatalogHero[];
	progress: HeroProgress[];
	source?: 'official' | 'estimate';
	signedIn?: boolean;
}) {
	const [query, setQuery] = useState('');
	const [filter, setFilter] = useState<'all' | 'played' | 'unplayed'>('all');
	const [sortMode, setSortMode] = useState<'game' | 'level' | 'games'>('game');
	const [selectedId, setSelectedId] = useState<number | null>(null);

	const progressById = useMemo(() => new Map(progress.map((hero) => [hero.heroId, hero])), [progress]);
	const selected = selectedId == null ? null : heroes.find((hero) => hero.id === selectedId) ?? null;
	const playedCount = progress.length;
	const officialProgress = progress.filter((hero) => hero.official);
	const masterCount = officialProgress.filter((hero) => hero.level >= 25).length;

	const groups = useMemo(() => {
		const value = query.trim().toLowerCase();
		return attributeSections.map((section) => {
			const rows = heroes
				.filter((hero) => hero.primaryAttr === section.key)
				.filter((hero) => {
					const item = progressById.get(hero.id);
					if (filter === 'played') return Boolean(item);
					if (filter === 'unplayed') return !item;
					return true;
				})
				.filter((hero) => !value || hero.localizedName.toLowerCase().includes(value) || hero.roles.some((role) => role.toLowerCase().includes(value)))
				.sort((a, b) => {
					const left = progressById.get(a.id);
					const right = progressById.get(b.id);
					if (sortMode === 'level') return (right?.level ?? 0) - (left?.level ?? 0) || (right?.games ?? 0) - (left?.games ?? 0);
					if (sortMode === 'games') return (right?.games ?? 0) - (left?.games ?? 0);
					return a.localizedName.localeCompare(b.localizedName, 'ru');
				});
			return { ...section, heroes: rows };
		});
	}, [filter, heroes, progressById, query, sortMode]);

	return (
		<div className="space-y-8">
			<div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
				<div className="obsidian-glass rounded-card p-4">
					<div className="text-xs uppercase tracking-wide text-muted">Сыграно героев</div>
					<div className="mt-1 font-display text-2xl text-cream">{playedCount} / {heroes.length}</div>
				</div>
				<div className="obsidian-glass rounded-card p-4">
					<div className="text-xs uppercase tracking-wide text-muted">Мастер 25+</div>
					<div className="mt-1 font-display text-2xl text-fuchsia-200">{masterCount}</div>
				</div>
				<div className="obsidian-glass rounded-card p-4">
					<div className="text-xs uppercase tracking-wide text-muted">Источник уровней</div>
					<div className="mt-1 font-display text-xl text-cream">{source === 'official' ? 'реплеи Dota Plus' : 'оценка OpenDota'}</div>
				</div>
			</div>

			<div className="flex flex-wrap items-center gap-3">
				<input
					value={query}
					onChange={(event) => setQuery(event.target.value)}
					placeholder="Поиск героя"
					className="w-full rounded-lg border border-line bg-panel px-3 py-2 text-cream outline-none focus:border-aegis sm:w-64"
				/>
				<div className="flex flex-wrap gap-2">
					{[
						{ id: 'all', label: 'Все' },
						{ id: 'played', label: 'С уровнем' },
						{ id: 'unplayed', label: 'Без игр' }
					].map((item) => (
						<button
							key={item.id}
							type="button"
							onClick={() => setFilter(item.id as typeof filter)}
							className={`rounded-full border px-3 py-1.5 text-sm ${filter === item.id ? 'border-aegis bg-aegis/10 text-aegisSoft' : 'border-line text-muted hover:text-cream'}`}
						>
							{item.label}
						</button>
					))}
				</div>
				<div className="flex flex-wrap gap-2">
					{[
						{ id: 'game', label: 'Как в игре' },
						{ id: 'level', label: 'По уровню' },
						{ id: 'games', label: 'По играм' }
					].map((item) => (
						<button
							key={item.id}
							type="button"
							onClick={() => setSortMode(item.id as typeof sortMode)}
							className={`rounded-full border px-3 py-1.5 text-sm ${sortMode === item.id ? 'border-aegis bg-aegis/10 text-aegisSoft' : 'border-line text-muted hover:text-cream'}`}
						>
							{item.label}
						</button>
					))}
				</div>
			</div>

			{selected ? (
				<HeroDataCard
					hero={selected}
					progress={progressById.get(selected.id)}
					signedIn={signedIn}
					onClose={() => setSelectedId(null)}
				/>
			) : null}

			{groups.map((group) => (
				<section key={group.key} className="space-y-3">
					<div className="flex items-center gap-2">
						<span className={`h-2.5 w-2.5 rounded-full ${group.marker}`} aria-hidden="true" />
						<h2 className={`font-display text-sm uppercase tracking-wide ${group.text}`}>{group.label}</h2>
						<span className="text-xs text-muted">{group.heroes.length}</span>
					</div>
					{group.heroes.length === 0 ? (
						<div className="text-sm text-muted">Нет героев по фильтру.</div>
					) : (
						<div className="grid grid-cols-4 gap-2 sm:grid-cols-6 md:grid-cols-8 lg:grid-cols-10 xl:grid-cols-12">
							{group.heroes.map((hero) => {
								const item = progressById.get(hero.id);
								const played = Boolean(item);
								const hasPlus = Boolean(item?.official && item.level > 0);
								return (
									<article key={hero.id} className="group relative aspect-[0.78]">
										<button
											type="button"
											onClick={() => setSelectedId(hero.id)}
											className={`relative h-full w-full overflow-hidden rounded border bg-panel text-left transition duration-200 group-hover:z-20 group-hover:scale-110 ${hasPlus && item ? tierFrame[item.tier] : played ? 'border-line' : 'border-line opacity-45 group-hover:opacity-100'} ${selectedId === hero.id ? 'ring-2 ring-aegis' : ''}`}
											aria-pressed={selectedId === hero.id}
											aria-label={`Данные ${hero.localizedName}`}
										>
											<HeroThumb apiName={hero.name} alt={hero.localizedName} />
											<div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/90 via-black/55 to-transparent px-1 pb-1 pt-6 text-center">
												<span className="block truncate text-[10px] text-cream">{hero.localizedName}</span>
												{item && <span className="block font-mono text-[10px] text-aegisSoft">{item.games} игр</span>}
											</div>
											{hasPlus && item && <PlusBadge tier={item.tier} level={item.level} />}
										</button>
										<div className="pointer-events-none absolute bottom-[calc(100%+10px)] left-1/2 z-30 hidden w-64 -translate-x-1/2 rounded-xl border border-aegis/40 bg-ink p-3 shadow-2xl group-hover:block">
											<div className="font-semibold text-cream">{hero.localizedName}</div>
											<div className="mt-1 text-xs text-muted">
												{attributeLabels[hero.primaryAttr] ?? hero.primaryAttr} · {hero.attackType === 'Melee' ? 'Ближний бой' : 'Дальний бой'}
											</div>
											<div className="mt-1 text-xs text-muted">{hero.roles.join(' · ')}</div>
											{item ? (
												<div className="mt-3 space-y-2 border-t border-line/70 pt-2 text-xs text-cream">
													{hasPlus ? (
														<>
															<div className="flex items-center justify-between">
																<span className="text-aegisSoft">{item.levelLabel}</span>
																<span className="font-mono">ур. {item.level}</span>
															</div>
															<div className="text-muted">Официальный XP Dota Plus из реплея</div>
															<div>{item.games} матчей · WR {item.winRate}%</div>
															<div className="h-1.5 overflow-hidden rounded bg-panel2">
																<div className="h-full bg-gradient-to-r from-aegis to-radiant" style={{ width: `${item.progressPct}%` }} />
															</div>
															<div className="text-muted">
																{item.nextLevelXp === null ? 'Максимальный уровень Dota Plus' : `До ур. ${item.level + 1}: ${item.xpToNext} XP`}
															</div>
														</>
													) : (
														<>
															<div className="text-muted">Есть матчи OpenDota, но официального уровня Plus ещё нет — бейдж как в игре не рисуем.</div>
															<div>{item.games} матчей · WR {item.winRate}%</div>
														</>
													)}
												</div>
											) : (
												<div className="mt-3 border-t border-line/70 pt-2 text-xs text-muted">Нет матчей в истории OpenDota — уровня пока нет.</div>
											)}
										</div>
									</article>
								);
							})}
						</div>
					)}
				</section>
			))}
		</div>
	);
}
