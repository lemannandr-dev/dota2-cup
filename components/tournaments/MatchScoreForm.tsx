'use client';

import React, { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Flag, Gavel, Minus, Plus, Send } from 'lucide-react';
import { fetchWithOfflineQueue } from '@/lib/offline-queue';
import { haptic } from '@/lib/haptics';
import { useToast } from '@/components/ui/ToastProvider';

type Props = {
	matchId: string;
	canReport: boolean;
	canForce: boolean;
	waiting?: boolean;
	teamAName?: string | null;
	teamBName?: string | null;
};

function ScoreStepper({ label, value, onChange }: { label: string; value: number; onChange: (value: number) => void }) {
	const change = (delta: number) => onChange(Math.max(0, Math.min(5, value + delta)));
	return (
		<div className="rounded-lg border border-line/70 bg-panel/60 p-2">
			<div className="mb-2 truncate text-xs text-muted">{label}</div>
			<div className="grid grid-cols-[3rem_1fr_3rem] items-center gap-2">
				<button type="button" onClick={() => change(-1)} disabled={value === 0} aria-label={`Уменьшить счёт ${label}`} className="score-stepper-button">
					<Minus className="h-5 w-5" aria-hidden="true" />
				</button>
				<output className="score-stepper-value" aria-live="polite" aria-label={`Счёт ${label}: ${value}`}>{value}</output>
				<button type="button" onClick={() => change(1)} disabled={value === 5} aria-label={`Увеличить счёт ${label}`} className="score-stepper-button">
					<Plus className="h-5 w-5" aria-hidden="true" />
				</button>
			</div>
		</div>
	);
}

function newIdempotencyKey() {
	if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') return crypto.randomUUID();
	return `report-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

export function MatchScoreForm({ matchId, canReport, canForce, waiting, teamAName, teamBName }: Props) {
	const router = useRouter();
	const { showToast } = useToast();
	const [scoreA, setScoreA] = useState(0);
	const [scoreB, setScoreB] = useState(0);
	const [dotaMatchIds, setDotaMatchIds] = useState('');
	const [error, setError] = useState<string | null>(null);
	const [busy, setBusy] = useState(false);
	const [pending, setPending] = useState(false);
	const idemRef = useRef<string | null>(null);

	async function send(url: string, extra: Record<string, unknown> = {}) {
		setBusy(true);
		setError(null);
		const ids = dotaMatchIds.split(/[\s,]+/).filter(Boolean);
		if (!idemRef.current) idemRef.current = newIdempotencyKey();
		const result = await fetchWithOfflineQueue({
			url,
			method: 'POST',
			idempotencyKey: idemRef.current,
			label: 'Сдать счёт',
			body: { scoreA, scoreB, dotaMatchIds: ids, ...extra }
		});
		if (result.offline) {
			setPending(true);
			showToast('Отправим, когда сеть вернётся', 'info');
			setBusy(false);
			return;
		}
		const data = result.json as { error?: string } | null;
		if (!result.ok) setError(data?.error || 'Не удалось сохранить счёт');
		else {
			idemRef.current = null;
			setPending(false);
			haptic('success');
			router.refresh();
		}
		setBusy(false);
	}

	if (!canReport && !canForce) return waiting ? <div className="text-[11px] text-muted">Ждём счёт соперника</div> : null;

	return (
		<div className="mt-3 space-y-3 rounded-lg border border-line/70 bg-black/20 p-3">
			{pending ? (
				<span className="inline-flex rounded-md border border-info/40 bg-info/10 px-2 py-0.5 text-[10px] uppercase tracking-wide text-info">
					В очереди офлайн
				</span>
			) : null}
			<div className="grid gap-2 sm:grid-cols-2">
				<ScoreStepper label={teamAName ?? 'Команда A'} value={scoreA} onChange={setScoreA} />
				<ScoreStepper label={teamBName ?? 'Команда B'} value={scoreB} onChange={setScoreB} />
			</div>
			<input value={dotaMatchIds} onChange={(e) => setDotaMatchIds(e.target.value)} inputMode="numeric" autoComplete="off" placeholder="Номер матча Dota 2 (необязательно)" className="min-h-12 w-full rounded-lg border border-line bg-panel px-3 text-base text-cream placeholder:text-muted" />
			<div className="flex flex-wrap gap-2">
				{canReport && (
					<button type="button" disabled={busy} onClick={() => send(`/api/matches/${matchId}/report`)} className="aegis-action inline-flex min-h-12 flex-1 items-center justify-center gap-2 rounded-lg bg-aegis px-4 text-sm font-semibold text-ink disabled:opacity-50">
						<Send className="h-4 w-4" aria-hidden="true" />
						Сдать счёт
					</button>
				)}
				{canForce && (
					<>
						<button type="button" disabled={busy} onClick={() => send(`/api/matches/${matchId}/result`)} className="inline-flex min-h-12 items-center justify-center gap-2 rounded-lg border border-aegis/50 px-4 text-sm text-aegisSoft disabled:opacity-50">
							<Gavel className="h-4 w-4" aria-hidden="true" />
							Судейский результат
						</button>
						<button
							type="button"
							disabled={busy}
							onClick={() => send(`/api/matches/${matchId}/result`, { forfeit: 'A' })}
							className="inline-flex min-h-12 items-center justify-center gap-2 rounded-lg border border-red-400/40 px-4 text-sm text-red-200 disabled:opacity-50"
						>
							<Flag className="h-4 w-4" aria-hidden="true" />
							Неявка {teamAName ?? 'команды A'}
						</button>
						<button
							type="button"
							disabled={busy}
							onClick={() => send(`/api/matches/${matchId}/result`, { forfeit: 'B' })}
							className="inline-flex min-h-12 items-center justify-center gap-2 rounded-lg border border-red-400/40 px-4 text-sm text-red-200 disabled:opacity-50"
						>
							<Flag className="h-4 w-4" aria-hidden="true" />
							Неявка {teamBName ?? 'команды B'}
						</button>
					</>
				)}
			</div>
			{error && <div className="text-xs text-red-200">{error}</div>}
		</div>
	);
}
