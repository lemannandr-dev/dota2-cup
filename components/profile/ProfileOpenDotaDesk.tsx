'use client';

import React, { useState, type ReactNode } from 'react';

type OpenDotaTab = 'summary' | 'heroes' | 'form' | 'matches';

const TABS: Array<{ id: OpenDotaTab; label: string }> = [
	{ id: 'summary', label: 'Сводка' },
	{ id: 'heroes', label: 'Герои' },
	{ id: 'form', label: 'Форма и роли' },
	{ id: 'matches', label: 'Матчи' }
];

export function ProfileOpenDotaDesk({
	sourceLabel,
	summary,
	heroes,
	form,
	matches
}: {
	sourceLabel?: string;
	summary: ReactNode;
	heroes: ReactNode;
	form: ReactNode;
	matches: ReactNode;
}) {
	const [tab, setTab] = useState<OpenDotaTab>('summary');
	const body = tab === 'heroes' ? heroes : tab === 'form' ? form : tab === 'matches' ? matches : summary;

	return (
		<section className="obsidian-glass rounded-card p-5">
			<div className="mb-4 flex flex-wrap items-end justify-between gap-2">
				<div>
					<h2 className="font-display text-lg text-cream">Статистика OpenDota</h2>
					<p className="mt-1 text-xs text-muted">Медаль и матчи отсюда не двигают рейтинг арены (+16 / −12).</p>
				</div>
				{sourceLabel && <span className="text-[11px] text-muted">{sourceLabel}</span>}
			</div>
			<div className="mb-4 flex flex-wrap gap-2">
				{TABS.map((item) => (
					<button
						key={item.id}
						type="button"
						onClick={() => setTab(item.id)}
						className={`rounded-full border px-3 py-1.5 text-xs ${
							tab === item.id ? 'border-aegis bg-aegis/10 text-aegisSoft' : 'border-line text-muted hover:text-cream'
						}`}
					>
						{item.label}
					</button>
				))}
			</div>
			{body}
		</section>
	);
}
