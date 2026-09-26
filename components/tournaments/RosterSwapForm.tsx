'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export type SwapPlayer = { userId: string; displayName: string };

export function RosterSwapForm({
	tournamentId,
	teamId,
	teamName,
	canSwap,
	locked,
	currentRoster,
	bench
}: {
	tournamentId: string;
	teamId: string;
	teamName?: string;
	canSwap: boolean;
	locked: boolean;
	currentRoster: SwapPlayer[];
	bench: SwapPlayer[];
}) {
	const router = useRouter();
	const [outUserId, setOutUserId] = useState(currentRoster[0]?.userId ?? '');
	const [inUserId, setInUserId] = useState(bench[0]?.userId ?? '');
	const [busy, setBusy] = useState(false);
	const [error, setError] = useState<string | null>(null);

	if (!canSwap) return null;

	async function send() {
		setBusy(true);
		setError(null);
		const response = await fetch(`/api/tournaments/${tournamentId}/roster`, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ teamId, outUserId, inUserId })
		});
		const data = await response.json().catch(() => null);
		if (!response.ok) setError(data?.error || 'Не удалось заменить игрока');
		else router.refresh();
		setBusy(false);
	}

	return (
		<div className="obsidian-glass h-full rounded-card space-y-3 p-4">
			<div>
				<p className="text-[10px] uppercase tracking-[0.16em] text-aegisSoft">Замена после отметки</p>
				<h3 className="mt-1 font-display text-lg text-cream">{teamName || 'Состав'}</h3>
				<p className="mt-1 text-xs leading-5 text-muted">
					Запасной должен быть в команде. Идущая пара держит старую пятёрку.
				</p>
			</div>
			{locked && (
				<p className="rounded-lg border border-[#F5D76E]/40 bg-[#F5D76E]/10 px-3 py-2 text-sm text-[#F5D76E]">
					Эта пара уже идёт. Замену можно сделать после закрытия счёта или спора.
				</p>
			)}
			{bench.length === 0 ? (
				<p className="text-sm text-muted">
					Нет подтверждённого запасного. Пригласите шестого игрока в команду — без него менять некого.
				</p>
			) : (
				<div className="grid gap-3 md:grid-cols-2">
					<label className="space-y-1 text-sm">
						<span className="text-muted">Снимаем</span>
						<select
							value={outUserId}
							onChange={(event) => setOutUserId(event.target.value)}
							className="w-full rounded-lg border border-line bg-panel px-3 py-2 text-cream"
						>
							{currentRoster.map((player) => (
								<option key={player.userId} value={player.userId}>
									{player.displayName}
								</option>
							))}
						</select>
					</label>
					<label className="space-y-1 text-sm">
						<span className="text-muted">Выходит</span>
						<select
							value={inUserId}
							onChange={(event) => setInUserId(event.target.value)}
							className="w-full rounded-lg border border-line bg-panel px-3 py-2 text-cream"
						>
							{bench.map((player) => (
								<option key={player.userId} value={player.userId}>
									{player.displayName}
								</option>
							))}
						</select>
					</label>
				</div>
			)}
			{bench.length > 0 && (
				<button
					type="button"
					disabled={busy || locked || !outUserId || !inUserId}
					onClick={() => void send()}
					className="rounded-full bg-aegis px-4 py-2 text-sm font-semibold text-ink disabled:opacity-50"
				>
					Заменить в заявке
				</button>
			)}
			{error && <p className="text-sm text-red-200">{error}</p>}
		</div>
	);
}
