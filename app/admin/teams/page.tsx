'use client';

import { useEffect, useState } from 'react';

type TeamRow = {
	id: string;
	name: string;
	owner: string;
	confirmed: number;
	steam: number;
	deletedAt: string | null;
	members?: Array<{ name: string; steam: boolean; confirmed: boolean }>;
};

export default function AdminTeamsPage() {
	const [items, setItems] = useState<TeamRow[]>([]);
	const [error, setError] = useState<string | null>(null);

	async function load() {
		const response = await fetch('/api/admin/teams', { cache: 'no-store' });
		const body = await response.json();
		if (!response.ok) setError(body.error || 'Не загрузилось');
		else setItems(body.teams || []);
	}

	useEffect(() => {
		void load();
	}, []);

	async function rename(id: string, name: string) {
		const response = await fetch('/api/admin/teams', {
			method: 'PATCH',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ id, name })
		});
		if (!response.ok) setError((await response.json()).error || 'Не сохранилось');
		else await load();
	}

	async function softDelete(id: string) {
		if (!confirm('Скрыть команду?')) return;
		const response = await fetch(`/api/admin/teams?id=${id}`, { method: 'DELETE' });
		if (!response.ok) setError((await response.json()).error || 'Не удалилось');
		else await load();
	}

	async function restore(id: string) {
		const response = await fetch('/api/admin/teams', {
			method: 'PATCH',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ id, restore: true })
		});
		if (!response.ok) setError((await response.json()).error || 'Не восстановилось');
		else await load();
	}

	return (
		<section className="space-y-3">
			{error && <p className="text-sm text-red-200">{error}</p>}
			{items.map((team) => (
				<article key={team.id} className="obsidian-glass flex flex-col gap-3 rounded-card p-4 md:flex-row md:items-center md:justify-between">
					<div>
						<input
							defaultValue={team.name}
							onBlur={(event) => {
								const next = event.target.value.trim();
								if (next && next !== team.name) void rename(team.id, next);
							}}
							className="rounded-lg border border-line bg-panel px-2 py-1 text-cream"
						/>
						<p className="mt-1 text-xs text-muted">
							{team.owner} · со Steam {team.steam} из 5 · подтверждено {team.confirmed}
							{team.deletedAt ? ' · скрыта' : ''}
						</p>
						{team.members && (
							<p className="mt-1 text-[11px] text-muted">
								{team.members.map((member) => `${member.name}${member.steam ? '' : ' без Steam'}${member.confirmed ? '' : ' не подтверждён'}`).join(' · ')}
							</p>
						)}
					</div>
					<div className="flex gap-3">
						<a href={`/teams`} className="text-sm text-aegisSoft">
							Каталог
						</a>
						{team.deletedAt ? (
							<button type="button" onClick={() => void restore(team.id)} className="text-sm text-aegisSoft">
								Вернуть
							</button>
						) : (
							<button type="button" onClick={() => void softDelete(team.id)} className="text-sm text-red-200">
								Скрыть
							</button>
						)}
					</div>
				</article>
			))}
		</section>
	);
}
