'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';

type Post = {
	id: string;
	note: string | null;
	roles: number[];
	mmrMin: number | null;
	mmrMax: number | null;
	expiresAt: string;
	user: { id: string; displayName: string; avatarUrl: string | null; rating: number; ratingGames?: number };
};

type Team = { id: string; name: string; tag: string | null };

export function LfgBoard({ posts, myTeams, currentUserId }: { posts: Post[]; myTeams: Team[]; currentUserId: string | null }) {
	const router = useRouter();
	const [roles, setRoles] = useState<number[]>([5]);
	const [note, setNote] = useState('');
	const [error, setError] = useState<string | null>(null);
	const [teamId, setTeamId] = useState(myTeams[0]?.id ?? '');

	function toggleRole(role: number) {
		setRoles((prev) => (prev.includes(role) ? prev.filter((item) => item !== role) : [...prev, role]));
	}

	async function publish() {
		setError(null);
		const res = await fetch('/api/lfg', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ roles, note })
		});
		const data = await res.json().catch(() => null);
		if (!res.ok) setError(data?.error || 'Не удалось опубликовать');
		else router.refresh();
	}

	async function invite(toUserId: string) {
		if (!teamId) return;
		const res = await fetch('/api/teams/invitations', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ teamId, toUserId })
		});
		const data = await res.json().catch(() => null);
		if (!res.ok) setError(data?.error || 'Инвайт не отправлен');
	}

	return (
		<div className="space-y-6">
			{currentUserId && (
				<div className="obsidian-glass rounded-card space-y-4 p-5">
					<h2 className="font-display text-xl text-cream">Моя анкета</h2>
					<div className="flex flex-wrap gap-2">
						{[1, 2, 3, 4, 5].map((role) => (
							<button key={role} type="button" onClick={() => toggleRole(role)} className={`rounded-full px-3 py-1 text-sm ${roles.includes(role) ? 'bg-aegis text-ink' : 'border border-line text-muted'}`}>
								{role} поз.
							</button>
						))}
					</div>
					<textarea value={note} onChange={(e) => setNote(e.target.value)} placeholder="Свободен сегодня с 19:00, ищу 4/5" className="w-full rounded-lg border border-line bg-panel px-3 py-2 text-cream" />
					<div className="flex gap-2">
						<button onClick={publish} className="rounded-full bg-aegis px-4 py-2 text-sm font-semibold text-ink">Опубликовать</button>
						<button onClick={async () => { await fetch('/api/lfg', { method: 'DELETE' }); router.refresh(); }} className="rounded-full border border-line px-4 py-2 text-sm text-muted">Снять</button>
					</div>
				</div>
			)}
			{myTeams.length > 0 && (
				<select value={teamId} onChange={(e) => setTeamId(e.target.value)} className="rounded-lg border border-line bg-panel px-3 py-2 text-cream">
					{myTeams.map((team) => <option key={team.id} value={team.id}>{team.name}</option>)}
				</select>
			)}
			{error && <div className="text-sm text-red-200">{error}</div>}
			<div className="overflow-hidden rounded-card border border-line">
				<table className="w-full text-left text-sm">
					<thead className="bg-panel2 text-xs uppercase text-muted">
						<tr>
							<th className="px-4 py-3">Игрок</th>
							<th className="px-4 py-3">Роли</th>
							<th className="px-4 py-3">MMR</th>
							<th className="px-4 py-3">Заметка</th>
							<th className="px-4 py-3"></th>
						</tr>
					</thead>
					<tbody className="divide-y divide-line/70">
						{posts.map((post) => (
							<tr key={post.id}>
								<td className="px-4 py-3 text-cream">{post.user.displayName}</td>
								<td className="px-4 py-3 font-mono text-muted">{post.roles.join(', ')}</td>
								<td className="px-4 py-3 text-muted">{post.mmrMin ?? '—'}–{post.mmrMax ?? '—'}</td>
								<td className="px-4 py-3 text-muted">{post.note}</td>
								<td className="px-4 py-3 text-right">
									{currentUserId && currentUserId !== post.user.id && (
										<button onClick={() => invite(post.user.id)} className="text-aegisSoft">Инвайт</button>
									)}
								</td>
							</tr>
						))}
						{posts.length === 0 && <tr><td colSpan={5} className="px-4 py-8 text-center text-muted">Активных анкет нет.</td></tr>}
					</tbody>
				</table>
			</div>
		</div>
	);
}
