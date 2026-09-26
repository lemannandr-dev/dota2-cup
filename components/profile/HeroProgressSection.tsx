'use client';

import React, { useMemo, useState } from 'react';
import type { HeroProgress } from '@/lib/dota-stats';
import { HeroMedia } from '@/components/heroes/HeroMedia';

type SortMode = 'level' | 'wr' | 'games';

function formatTime(unixSeconds: number): string {
	if (!unixSeconds) return 'Неизвестно';
	const moscowTime = new Date((unixSeconds + 3 * 60 * 60) * 1000);
	const day = String(moscowTime.getUTCDate()).padStart(2, '0');
	const month = String(moscowTime.getUTCMonth() + 1).padStart(2, '0');
	return `${day}.${month}.${moscowTime.getUTCFullYear()}`;
}

function levelTier(level: number): { ring: string; bg: string; symbol: string; name: string; accent: string } {
	if (level >= 30) return { ring: 'border-amber-200', bg: 'from-amber-300/40 via-yellow-400/20 to-red-500/25', symbol: '30', name: 'Грандмастер', accent: 'text-amber-200' };
	if (level >= 25) return { ring: 'border-fuchsia-300/70', bg: 'from-fuchsia-500/30 to-indigo-400/20', symbol: '25', name: 'Мастер', accent: 'text-fuchsia-200' };
	if (level >= 18) return { ring: 'border-cyan-200/70', bg: 'from-cyan-500/30 to-sky-300/20', symbol: '18', name: 'Платина', accent: 'text-cyan-200' };
	if (level >= 12) return { ring: 'border-aegis', bg: 'from-aegis/30 to-amber-300/20', symbol: '12', name: 'Золото', accent: 'text-aegisSoft' };
	if (level >= 6) return { ring: 'border-slate-200/70', bg: 'from-slate-400/25 to-slate-200/15', symbol: '6', name: 'Серебро', accent: 'text-slate-100' };
	return { ring: 'border-[#b08a5c]/70', bg: 'from-amber-800/25 to-amber-600/10', symbol: '1', name: 'Бронза', accent: 'text-amber-100' };
}

function LevelMedal({ level, label }: { level: number; label: string }) {
	const stars = Math.min(5, Math.max(1, level % 5 || 5));
	const tier = levelTier(level);
	const isArcana = level >= 30;
	return (
		<div className={`inline-flex items-center gap-2 rounded-md border ${tier.ring} bg-gradient-to-r ${tier.bg} px-2 py-1.5 ${isArcana ? 'hero-arcana-medal' : ''}`} title={`${tier.name}: уровень ${level}`}>
			<div className={`flex h-9 w-9 shrink-0 items-center justify-center border ${tier.ring} bg-black/30 text-xs font-black ${tier.accent} hero-medal-mark`}>
				{tier.symbol}
			</div>
			<div className="leading-tight">
				<div className="flex items-center gap-1.5">
					<span className="text-sm font-bold text-cream">УР. {level}</span>
					{isArcana && <span className="rounded border border-amber-200/60 bg-amber-100/10 px-1 text-[9px] font-bold tracking-widest text-amber-100">ARCANA</span>}
				</div>
				<div className="flex items-center gap-1 text-[10px]">
					<span className="text-cream/90">{label}</span>
					<span className={tier.accent}>{'★'.repeat(stars)}{'☆'.repeat(5 - stars)}</span>
				</div>
			</div>
		</div>
	);
}

export function HeroProgressSection({
	heroes,
	source = 'estimate'
}: {
	heroes: HeroProgress[];
	source?: 'official' | 'estimate';
}) {
	const [sortMode, setSortMode] = useState<SortMode>('level');

	const sortedHeroes = useMemo(() => {
		const copy = [...heroes];
		if (sortMode === 'level') {
			copy.sort((a, b) => (b.level - a.level) || (b.xp - a.xp));
		}
		if (sortMode === 'wr') {
			copy.sort((a, b) => (b.winRate - a.winRate) || (b.games - a.games));
		}
		if (sortMode === 'games') {
			copy.sort((a, b) => b.games - a.games);
		}
		return copy;
	}, [heroes, sortMode]);

	return (
		<section className="mt-6">
			<div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between mb-3">
				<h3 className="text-lg font-semibold">Герои игрока: уровень и история</h3>
				<div className="inline-flex rounded-full border border-gray-700 bg-gray-900 p-1">
					{[
						{ id: 'level', label: 'По уровню' },
						{ id: 'wr', label: 'По WR' },
						{ id: 'games', label: 'По играм' }
					].map((opt) => (
						<button
							key={opt.id}
							type="button"
							onClick={() => setSortMode(opt.id as SortMode)}
							className={`rounded-full px-3 py-1 text-xs transition-colors ${sortMode === opt.id ? 'bg-aegis text-ink font-semibold' : 'text-gray-300 hover:text-white'}`}
						>
							{opt.label}
						</button>
					))}
				</div>
			</div>
			<p className="text-sm text-gray-300 mb-3">
				{source === 'official'
					? 'Уровни и XP взяты из снимка клиента Dota 2. История матчей ниже по-прежнему из OpenDota.'
					: 'Уровни считаются по таблице Dota Plus: 50 XP за матч и ещё 50 XP за победу. Челленджи Plus OpenDota не отдаёт, поэтому это оценка по публичной истории.'}
			</p>
			{sortedHeroes.length === 0 && (
				<div className="p-4 rounded bg-gray-900 border border-gray-800 text-gray-300">Данных по прогрессу героев пока нет.</div>
			)}
			{sortedHeroes.length > 0 && (
				<div className="space-y-3">
					{sortedHeroes.map((hero) => (
						<div key={hero.heroId} className="rounded border border-gray-800 bg-gray-900 p-4">
							<div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
								<div className="flex items-center gap-3">
									{hero.heroImage ? (
										<HeroMedia src={hero.heroImage} alt={hero.heroName} width={80} height={40} className="h-10 w-20 rounded border border-gray-700 object-cover" />
									) : (
										<div className="h-10 w-20 rounded border border-gray-700 bg-gray-800" />
									)}
									<div>
										<div className="text-white font-semibold">{hero.heroName}</div>
										<div className="text-xs text-gray-300">{hero.games} матчей • WR {hero.winRate}% • Последняя игра: {formatTime(hero.lastPlayed)}</div>
									</div>
								</div>
								<LevelMedal level={hero.level} label={hero.levelLabel} />
							</div>
							<div className="mt-3">
								<div className="mb-1 flex items-center justify-between text-xs text-gray-300">
									<span>Опыт героя: {hero.xp}</span>
									<span>{hero.nextLevelXp !== null ? `До следующего уровня: ${hero.xpToNext}` : 'MAX уровень'}</span>
								</div>
								<div className="h-2 w-full rounded-full bg-gray-800 border border-gray-700 overflow-hidden">
									<div className="h-full bg-gradient-to-r from-aegis/75 to-radiant/85" style={{ width: `${hero.progressPct}%` }} />
								</div>
								<div className="mt-1 text-xs text-gray-400">{hero.nextLevelXp !== null ? `${hero.levelStartXp} / ${hero.nextLevelXp} XP` : 'Достигнут максимальный уровень прогресса'}</div>
							</div>
							{hero.history.length > 0 && (
								<div className="mt-3 space-y-2">
									<div className="text-xs uppercase tracking-wide text-gray-400">История по герою</div>
									{hero.history.map((entry) => (
										<div key={entry.matchId} className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-gray-200">
											<span>Дата: {formatTime(entry.startedAt)}</span>
											<span>K/D/A: {entry.kda}</span>
											<span>Роль: {entry.role}</span>
											<span>Патч: {entry.patchLabel}</span>
											<span className={entry.result === 'Выиграл' ? 'text-green-400 font-semibold' : 'text-red-400 font-semibold'}>{entry.result}</span>
										</div>
									))}
								</div>
							)}
						</div>
					))}
				</div>
			)}
		</section>
	);
}
