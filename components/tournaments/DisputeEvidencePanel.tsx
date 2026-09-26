'use client';

import React, { useState } from 'react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { useToast } from '@/components/ui/ToastProvider';

export type DisputeRow = {
	id: string;
	reason: string;
	details: string | null;
	status: string;
	hasEvidence: boolean;
	evidenceKind: string | null;
	evidenceUrl: string | null;
	evidenceName: string | null;
};

export function DisputeEvidencePanel({
	matchId,
	disputes,
	canUpload,
	canView,
	canResolve = false
}: {
	matchId: string;
	disputes: DisputeRow[];
	canUpload: boolean;
	canView: boolean;
	canResolve?: boolean;
}) {
	const router = useRouter();
	const { showToast } = useToast();
	const [vodUrl, setVodUrl] = useState('');
	const [resolution, setResolution] = useState('');
	const [error, setError] = useState<string | null>(null);
	const [busy, setBusy] = useState(false);
	const open = disputes.find((row) => row.status === 'OPEN' || row.status === 'IN_REVIEW') ?? disputes[0];

	async function attachFile(file: File) {
		if (!open) return;
		setBusy(true);
		setError(null);
		try {
			const body = new FormData();
			body.append('file', file);
			const response = await fetch(`/api/matches/${matchId}/disputes/${open.id}/evidence`, { method: 'POST', body });
			const data = await response.json().catch(() => null);
			if (!response.ok) setError(data?.error || 'Не удалось загрузить файл');
			else {
				showToast('Скриншот прикреплён');
				router.refresh();
			}
		} catch {
			setError('Нет связи с сервером. Файл не загружен.');
		} finally {
			setBusy(false);
		}
	}

	async function attachVod() {
		if (!open) return;
		setBusy(true);
		setError(null);
		const idem =
			typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
				? crypto.randomUUID()
				: `vod-${Date.now()}`;
		const { fetchWithOfflineQueue } = await import('@/lib/offline-queue');
		const { haptic } = await import('@/lib/haptics');
		const result = await fetchWithOfflineQueue({
			url: `/api/matches/${matchId}/disputes/${open.id}/evidence`,
			method: 'POST',
			idempotencyKey: idem,
			label: 'Доказательство спора',
			body: { vodUrl }
		});
		if (result.offline) {
			showToast('Отправим, когда сеть вернётся', 'info');
			setBusy(false);
			return;
		}
		const data = result.json as { error?: string } | null;
		if (!result.ok) setError(data?.error || 'Не удалось сохранить ссылку');
		else {
			setVodUrl('');
			haptic('success');
			showToast('Ссылка на VOD прикреплена');
			router.refresh();
		}
		setBusy(false);
	}

	async function resolve(status: 'RESOLVED' | 'REJECTED') {
		if (!open) return;
		setBusy(true);
		setError(null);
		try {
			const response = await fetch(`/api/matches/${matchId}/disputes`, {
				method: 'PUT',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ disputeId: open.id, status, resolution })
			});
			const data = await response.json().catch(() => null);
			if (!response.ok) setError(data?.error || 'Не удалось записать решение');
			else {
				showToast(status === 'RESOLVED' ? 'Решение судьи записано' : 'Спор отклонён', 'info');
				router.refresh();
			}
		} catch {
			setError('Нет связи с сервером. Решение не сохранено.');
		} finally {
			setBusy(false);
		}
	}

	if (disputes.length === 0 && !canUpload && !canResolve) return null;

	return (
		<div className="space-y-3 rounded-lg border border-red-900/50 bg-red-950/20 p-3">
			<div className="text-xs uppercase tracking-wide text-red-200">Спор</div>
			{disputes.map((row) => (
				<div key={row.id} className="text-sm text-cream space-y-2">
					<div>
						{row.reason}
						{row.details ? ` · ${row.details}` : ''}
					</div>
					{row.hasEvidence && !canView && <p className="text-xs text-muted">Есть вложение. Смотреть могут участники пары и судья.</p>}
					{canView && row.evidenceKind === 'image' && (
						<Image
							src={`/api/matches/${matchId}/disputes/${row.id}/evidence`}
							alt={row.evidenceName || 'Скрин спора'}
							width={640}
							height={360}
							unoptimized
							className="max-h-56 rounded border border-line object-contain"
						/>
					)}
					{canView && row.evidenceKind === 'vod' && row.evidenceUrl && (
						<a href={row.evidenceUrl} target="_blank" rel="noreferrer" className="text-aegisSoft hover:text-aegis">
							Открыть VOD
						</a>
					)}
				</div>
			))}
			{canResolve && open && (open.status === 'OPEN' || open.status === 'IN_REVIEW') && (
				<div className="space-y-3 rounded-lg border border-aegis/30 bg-black/20 p-3">
					<label htmlFor={`resolution-${open.id}`} className="text-sm font-medium text-aegisSoft">Решение судьи</label>
					<textarea
						id={`resolution-${open.id}`}
						value={resolution}
						onChange={(event) => setResolution(event.target.value)}
						placeholder="По скрину / VOD засчитываю счёт команды A 2:1"
						className="min-h-24 w-full rounded-lg border border-line bg-panel px-3 py-3 text-base text-cream"
						rows={3}
					/>
					<div className="flex flex-wrap gap-2">
						<button
							type="button"
							disabled={busy || resolution.trim().length < 3}
							onClick={() => void resolve('RESOLVED')}
							className="aegis-action min-h-11 rounded-lg bg-aegis px-3 text-sm font-semibold text-ink disabled:opacity-50"
						>
							Принять сторону / закрыть
						</button>
						<button
							type="button"
							disabled={busy || resolution.trim().length < 3}
							onClick={() => void resolve('REJECTED')}
							className="min-h-11 rounded-lg border border-line px-3 text-sm text-muted disabled:opacity-50"
						>
							Отклонить спор
						</button>
					</div>
				</div>
			)}
			{canUpload && open && (
				<div className="space-y-2">
					<input
						type="file"
						accept="image/png,image/jpeg,image/webp"
						capture="environment"
						disabled={busy}
						onChange={(event) => {
							const file = event.target.files?.[0];
							if (file) void attachFile(file);
						}}
						className="block min-h-12 w-full rounded-lg border border-line bg-black/20 p-2 text-sm text-muted file:mr-3 file:min-h-9 file:rounded-md file:border-0 file:bg-aegis file:px-3 file:text-sm file:font-semibold file:text-ink"
					/>
					<p className="text-xs text-muted">PNG, JPEG или WebP.</p>
					<div className="grid gap-2 sm:grid-cols-[1fr_auto]">
						<input
							value={vodUrl}
							onChange={(event) => setVodUrl(event.target.value)}
							placeholder="https://youtu.be/… или Twitch"
							inputMode="url"
							className="min-h-12 w-full rounded-lg border border-line bg-panel px-3 text-base text-cream"
						/>
						<button
							type="button"
							disabled={busy || !vodUrl}
							onClick={() => void attachVod()}
							className="min-h-12 rounded-lg border border-aegis/50 px-4 text-sm font-semibold text-aegisSoft disabled:opacity-50"
						>
							VOD
						</button>
					</div>
				</div>
			)}
			{error && <p className="text-xs text-red-300">{error}</p>}
		</div>
	);
}
