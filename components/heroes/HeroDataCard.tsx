'use client';

import { useEffect, useState } from 'react';
import type { HeroProgress, HeroRecentForm } from '@/lib/dota-stats';
import { HeroThumb } from '@/components/heroes/HeroThumb';

type CardHero = {
	id: number;
	name: string;
	localizedName: string;
	primaryAttr: string;
	attackType: string;
	roles: string[];
};

const attributeLabels: Record<string, string> = {
	str: 'Сила',
	agi: 'Ловкость',
	int: 'Интеллект',
	all: 'Универсальный'
};

export function HeroDataCard({
	hero,
	progress,
	signedIn,
	onClose
}: {
	hero: CardHero;
	progress?: HeroProgress;
	signedIn: boolean;
	onClose: () => void;
}) {
	const [form, setForm] = useState<HeroRecentForm | null>(null);
	const [loading, setLoading] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const losses = progress ? Math.max(0, progress.games - progress.win) : 0;

	useEffect(() => {
		if (!signedIn || !progress) {
			setForm(null);
			setLoading(false);
			setError(null);
			return;
		}
		let cancelled = false;
		setLoading(true);
		setError(null);
		setForm(null);
		void fetch(`/api/heroes/${hero.id}/stats`, { cache: 'no-store' })
			.then(async (res) => {
				const data = await res.json().catch(() => null);
				if (!res.ok) throw new Error(data?.error ?? 'Не удалось загрузить форму героя.');
				return data.stats as HeroRecentForm;
			})
			.then((stats) => {
				if (!cancelled) setForm(stats);
			})
			.catch((err: unknown) => {
				if (!cancelled) setError(err instanceof Error ? err.message : 'Нет данных OpenDota.');
			})
			.finally(() => {
				if (!cancelled) setLoading(false);
			});
		return () => {
			cancelled = true;
		};
	}, [hero.id, progress, signedIn]);

	const streakLabel = form?.streak
		? `${form.streak.result === 'W' ? 'Побед' : 'Поражений'} подряд: ${form.streak.count}`
		: 'Стрика нет';

	return (
		<section
			data-hero-card="true"
			className="obsidian-glass rounded-card space-y-4 p-4"
			aria-label={`Данные героя ${hero.localizedName}`}
		>
			<div className="flex items-start justify-between gap-3">
				<div className="flex min-w-0 items-center gap-3">
					<div className="relative h-16 w-12 overflow-hidden rounded border border-line">
						<HeroThumb apiName={hero.name} alt={hero.localizedName} width={48} height={64} className="h-16 w-12 object-cover" />
					</div>
					<div className="min-w-0">
						<p className="font-display text-xl text-cream">{hero.localizedName}</p>
						<p className="mt-1 text-xs text-muted">
							{attributeLabels[hero.primaryAttr] ?? hero.primaryAttr} · {hero.attackType === 'Melee' ? 'Ближний бой' : 'Дальний бой'}
						</p>
						<p className="mt-1 text-xs text-muted">{hero.roles.join(' · ')}</p>
					</div>
				</div>
				<button type="button" onClick={onClose} className="text-sm text-muted hover:text-cream">
					Закрыть
				</button>
			</div>
			{progress ? (
				<div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
					<div className="rounded-lg border border-line bg-black/20 px-3 py-2">
						<p className="text-[10px] uppercase tracking-[0.14em] text-muted">Игры</p>
						<p className="mt-1 font-mono text-cream">{progress.games}</p>
					</div>
					<div className="rounded-lg border border-line bg-black/20 px-3 py-2">
						<p className="text-[10px] uppercase tracking-[0.14em] text-muted">Победы</p>
						<p className="mt-1 font-mono text-cream">{progress.win}</p>
					</div>
					<div className="rounded-lg border border-line bg-black/20 px-3 py-2">
						<p className="text-[10px] uppercase tracking-[0.14em] text-muted">Поражения</p>
						<p className="mt-1 font-mono text-cream">{losses}</p>
					</div>
					<div className="rounded-lg border border-line bg-black/20 px-3 py-2">
						<p className="text-[10px] uppercase tracking-[0.14em] text-muted">Winrate</p>
						<p className="mt-1 font-mono text-cream">{progress.winRate}%</p>
					</div>
				</div>
			) : (
				<p className="text-sm text-muted">Нет матчей в истории OpenDota — карьеры по этому герою нет.</p>
			)}
			{progress?.official && progress.level > 0 ? (
				<p className="text-xs text-aegisSoft">
					Plus {progress.levelLabel} · ур. {progress.level}. Бейдж из реплея, не оценка OpenDota.
				</p>
			) : null}
			{signedIn && progress ? (
				<div className="space-y-3 border-t border-line/60 pt-3">
					<p className="text-xs text-muted">Последние 20 игр этим героем · OpenDota</p>
					{loading ? <p className="text-sm text-muted">Считаем форму…</p> : null}
					{error ? <p className="text-sm text-dire">{error}</p> : null}
					{form?.averages ? (
						<div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
							<div className="text-xs text-muted">K {form.averages.kills}</div>
							<div className="text-xs text-muted">D {form.averages.deaths}</div>
							<div className="text-xs text-muted">A {form.averages.assists}</div>
							<div className="text-xs text-cream">KDA {form.averages.kda}</div>
							<div className="text-xs text-cream">GPM {form.averages.gpm}</div>
							<div className="text-xs text-cream">XPM {form.averages.xpm}</div>
						</div>
					) : null}
					{form ? <p className="text-sm text-cream">{streakLabel}</p> : null}
					{form?.form.length ? (
						<ol className="flex flex-wrap gap-1" aria-label="Последние 20 игр">
							{form.form.map((pip, index) => (
								<li
									key={`${pip}-${index}`}
									className={`h-5 w-5 rounded-sm text-center font-mono text-[10px] leading-5 ${
										pip === 'W' ? 'bg-radiant/30 text-radiant' : 'bg-dire/30 text-dire'
									}`}
								>
									{pip}
								</li>
							))}
						</ol>
					) : null}
				</div>
			) : signedIn ? null : (
				<p className="text-sm text-muted">Войдите через Steam, чтобы увидеть форму, KDA и последние 20 игр.</p>
			)}
		</section>
	);
}
