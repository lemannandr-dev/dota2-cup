'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import type { MatchLobby } from '@/lib/match-lobby';
import { CopyLobbyButton } from '@/components/desk/CopyLobby';
import { fetchWithOfflineQueue } from '@/lib/offline-queue';
import { useToast } from '@/components/ui/ToastProvider';

function newIdem() {
	if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') return crypto.randomUUID();
	return `lobby-${Date.now()}`;
}

export function MatchLobbyCard({
	matchId,
	lobby,
	canPost,
	canSeeSecrets
}: {
	matchId: string;
	lobby: MatchLobby | null;
	canPost: boolean;
	canSeeSecrets: boolean;
}) {
	const router = useRouter();
	const { showToast } = useToast();
	const [name, setName] = useState(lobby?.name ?? '');
	const [password, setPassword] = useState(lobby?.password ?? '');
	const [region, setRegion] = useState(lobby?.region ?? '');
	const [voiceUrl, setVoiceUrl] = useState(lobby?.voiceUrl ?? '');
	const [busy, setBusy] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [pending, setPending] = useState(false);

	async function send(playing = false) {
		setBusy(true);
		setError(null);
		const result = await fetchWithOfflineQueue({
			url: `/api/matches/${matchId}/lobby`,
			method: 'PUT',
			idempotencyKey: newIdem(),
			label: playing ? 'Лобби: играем' : 'Выложить лобби',
			body: { name, password: password || null, region: region || null, voiceUrl: voiceUrl || null, playing }
		});
		if (result.offline) {
			setPending(true);
			showToast('Отправим, когда сеть вернётся', 'info');
			setBusy(false);
			return;
		}
		const data = result.json as { error?: string } | null;
		if (!result.ok) setError(data?.error || 'Не удалось сохранить лобби');
		else {
			setPending(false);
			router.refresh();
		}
		setBusy(false);
	}

	return (
		<div className="space-y-3 rounded-lg border border-aegis/30 bg-black/20 p-3">
			<div className="flex flex-wrap items-center justify-between gap-2">
				<div className="text-xs uppercase tracking-wide text-aegisSoft">Как зайти в катку</div>
				{pending ? (
					<span className="rounded-md border border-info/40 bg-info/10 px-2 py-0.5 text-[10px] uppercase tracking-wide text-info">
						В очереди офлайн
					</span>
				) : null}
			</div>
			{lobby ? (
				<div className="space-y-1 text-sm text-cream">
					<div>
						1. Лобби: <span className="font-semibold">{lobby.name}</span>
						{lobby.region ? ` · ${lobby.region}` : ''}
						{lobby.hostName ? ` · хост ${lobby.hostName}` : ''}
					</div>
					{canSeeSecrets ? (
						<div className="font-mono text-aegisSoft">2. Пароль: {lobby.password || 'без пароля'}</div>
					) : (
						<p className="text-xs text-muted">2. Пароль видят только участники этой пары и судья.</p>
					)}
					{canSeeSecrets ? (
						lobby.voiceUrl ? (
							<a href={lobby.voiceUrl} target="_blank" rel="noreferrer" className="block text-aegisSoft hover:text-aegis">
								3. Голосовой — зайти вместе с лобби
							</a>
						) : (
							<p className="text-xs text-muted">3. Голосовой ещё не указан — капитан пишет Discord или Telegram рядом с паролем.</p>
						)
					) : (
						<p className="text-xs text-muted">3. Куда говорить — только составу пары.</p>
					)}
					{lobby.playing && <div className="text-xs text-[#5EE7F2]">Капитан пишет: зашли, играем.</div>}
					{canSeeSecrets && (
						<CopyLobbyButton name={lobby.name} password={lobby.password} region={lobby.region} voiceUrl={lobby.voiceUrl} />
					)}
				</div>
			) : (
				<p className="text-sm text-muted">Капитан ещё не выложил лобби. Нужны имя, пароль и куда говорить — одним шагом.</p>
			)}
			{canPost && (
				<div className="grid gap-2 md:grid-cols-2">
					<input value={name} onChange={(e) => setName(e.target.value)} autoComplete="off" placeholder="Имя лобби" className="min-h-12 rounded-lg border border-line bg-panel px-3 text-base text-cream placeholder:text-muted" />
					<input value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="off" placeholder="Пароль" className="min-h-12 rounded-lg border border-line bg-panel px-3 text-base text-cream placeholder:text-muted" />
					<input value={region} onChange={(e) => setRegion(e.target.value)} autoComplete="off" placeholder="Сервер, например EU West" className="min-h-12 rounded-lg border border-line bg-panel px-3 text-base text-cream placeholder:text-muted" />
					<input value={voiceUrl} onChange={(e) => setVoiceUrl(e.target.value)} inputMode="url" autoComplete="url" placeholder="Голосовой: discord.gg/… или t.me/…" className="min-h-12 rounded-lg border border-line bg-panel px-3 text-base text-cream placeholder:text-muted" />
					<div className="flex flex-wrap gap-2 md:col-span-2">
						<button type="button" disabled={busy || name.trim().length < 2} onClick={() => void send(false)} className="aegis-action min-h-12 flex-1 rounded-lg bg-aegis px-4 text-sm font-semibold text-ink disabled:opacity-50">
							Выложить лобби
						</button>
						<button type="button" disabled={busy || name.trim().length < 2} onClick={() => void send(true)} className="min-h-12 flex-1 rounded-lg border border-aegis/50 px-4 text-sm text-aegisSoft disabled:opacity-50">
							Зашли, играем
						</button>
					</div>
				</div>
			)}
			{error && <p className="text-xs text-red-300">{error}</p>}
		</div>
	);
}
