'use client';

import React, { useMemo, useState } from 'react';
import type { LandingPlayer, LandingRoster } from '@/lib/landing-live';
import { StatusPill } from '@/components/dota/StatusPill';

const tabs = ['Игроки', 'Ищут пати', 'Составы'] as const;

export function PlayersSection({ players, rosters }: { players: LandingPlayer[]; rosters: LandingRoster[] }) {
	const [tab, setTab] = useState<(typeof tabs)[number]>('Игроки');
	const [query, setQuery] = useState('');

	const visible = useMemo(
		() =>
			players.filter((player) => {
				if (tab === 'Ищут пати' && !player.looking) return false;
				if (query && !player.displayName.toLowerCase().includes(query.toLowerCase())) return false;
				return true;
			}),
		[players, query, tab]
	);

	return (
		<section id="players" className="max-w-shell mx-auto px-4 md:px-6 lg:px-10 py-20 md:py-28 scroll-mt-20">
			<p className="text-xs tracking-[0.3em] text-aegis font-mono mb-4">ИГРОКИ С АРЕНЫ</p>
			<h2 className="font-display font-bold uppercase text-3xl md:text-5xl text-cream leading-tight">
				Найдите недостающую позицию
			</h2>
			<p className="mt-4 text-muted max-w-2xl">
				Только те, кто уже заходил через Steam. Рейтинг — арена, не медаль OpenDota. Пригласить можно на живом поиске пати.
			</p>

			<div role="tablist" aria-label="Категории поиска" className="mt-8 flex flex-wrap gap-2">
				{tabs.map((item) => (
					<button
						key={item}
						role="tab"
						aria-selected={tab === item}
						type="button"
						onClick={() => setTab(item)}
						className={`px-4 py-2 rounded-full text-sm border transition-colors min-h-[44px] ${
							tab === item ? 'border-aegis text-aegisSoft bg-aegis/10' : 'border-line text-muted hover:text-cream'
						}`}
					>
						{item}
					</button>
				))}
			</div>

			{tab !== 'Составы' && (
				<div className="mt-4">
					<input
						value={query}
						onChange={(event) => setQuery(event.target.value)}
						placeholder="Ник на арене"
						className="px-4 py-2.5 rounded-lg bg-panel border border-line text-cream placeholder:text-muted focus:outline-none focus:border-aegis/60 min-h-[44px] w-full sm:w-64"
					/>
				</div>
			)}

			{tab === 'Составы' ? (
				<div className="mt-8 grid grid-cols-1 md:grid-cols-2 gap-4">
					{rosters.map((team) => (
						<a key={team.id} href={team.href} className="obsidian-glass rounded-card p-5 hover:border-aegis/40">
							<div className="font-display text-lg text-cream">{team.name}</div>
							<p className="mt-1 text-sm text-muted">
								Подтверждено {team.confirmed} из 5. Это каталог команд, не сетка турнира.
							</p>
						</a>
					))}
					{rosters.length === 0 && <p className="text-sm text-muted">Команд пока нет. Создайте на странице «Команды».</p>}
				</div>
			) : (
				<div className="mt-8 overflow-hidden rounded-card border border-line bg-panel/40">
					<table className="w-full text-left text-sm">
						<thead className="bg-panel2 text-xs uppercase tracking-wide text-muted">
							<tr>
								<th className="px-4 py-3">Игрок</th>
								<th className="px-4 py-3">Рейтинг арены</th>
								<th className="px-4 py-3">Steam</th>
								<th className="px-4 py-3">Статус</th>
								<th className="px-4 py-3"></th>
							</tr>
						</thead>
						<tbody className="divide-y divide-line/70">
							{visible.map((player) => (
								<tr key={player.id}>
									<td className="px-4 py-3 text-cream">{player.displayName}</td>
									<td className="px-4 py-3 font-mono text-cream">{player.ratingLabel}</td>
									<td className="px-4 py-3">
										<StatusPill tone={player.steamConfirmed ? 'radiant' : 'muted'}>
											{player.steamConfirmed ? 'подтверждён' : 'нет'}
										</StatusPill>
									</td>
									<td className="px-4 py-3 text-muted">
										{player.looking ? player.note || 'Ищет пати' : 'Не ищет пати'}
										{player.roles.length > 0 ? ` · поз. ${player.roles.join('/')}` : ''}
									</td>
									<td className="px-4 py-3 text-right">
										<a href="/party-search" className="text-sm text-aegisSoft hover:text-aegis">
											Искать на арене
										</a>
									</td>
								</tr>
							))}
							{visible.length === 0 && (
								<tr>
									<td colSpan={5} className="px-4 py-8 text-center text-muted">
										Никого нет. Войдите через Steam — профиль появится здесь.
									</td>
								</tr>
							)}
						</tbody>
					</table>
				</div>
			)}
		</section>
	);
}
