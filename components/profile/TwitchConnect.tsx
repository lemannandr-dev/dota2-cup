'use client';

import React, { useState } from 'react';

export function TwitchConnect({ initialChannel }: { initialChannel?: string | null }) {
	const [channel, setChannel] = useState(initialChannel ?? '');
	const [saved, setSaved] = useState(initialChannel ?? '');
	const [busy, setBusy] = useState(false);
	const [error, setError] = useState<string | null>(null);

	async function save() {
		setBusy(true);
		setError(null);
		const res = await fetch('/api/twitch/connect', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ twitchChannel: channel })
		});
		const data = await res.json().catch(() => null);
		if (!res.ok) {
			setError(data?.error || 'Не удалось сохранить канал');
			setBusy(false);
			return;
		}
		setSaved(data.channel?.login ?? channel);
		setChannel(data.channel?.login ?? channel);
		setBusy(false);
	}

	async function clearChannel() {
		setBusy(true);
		await fetch('/api/twitch/connect', { method: 'DELETE' });
		setSaved('');
		setChannel('');
		setBusy(false);
	}

	return (
		<section className="obsidian-glass rounded-card space-y-3 p-5">
			<div>
				<div className="font-display text-lg text-cream">Twitch Live</div>
				<p className="mt-1 text-sm text-muted">
					Привяжите канал — на главной появится окно эфира рядом со счётом пары. Если трансляция идёт, сайт сам увидит её через Twitch Helix.
				</p>
			</div>
			<div className="flex flex-wrap gap-2">
				<input
					value={channel}
					onChange={(event) => setChannel(event.target.value)}
					placeholder="логин или https://twitch.tv/канал"
					className="min-w-[220px] flex-1 rounded-lg border border-line bg-panel px-3 py-2 text-sm text-cream outline-none focus:border-aegis"
				/>
				<button type="button" disabled={busy || !channel.trim()} onClick={save} className="rounded-full bg-aegis px-4 py-2 text-sm font-semibold text-ink disabled:opacity-50">
					{busy ? 'Проверяем…' : 'Привязать'}
				</button>
				{saved && (
					<button type="button" disabled={busy} onClick={clearChannel} className="rounded-full border border-line px-4 py-2 text-sm text-muted">
						Отвязать
					</button>
				)}
			</div>
			{saved && <div className="text-xs text-aegisSoft">Сейчас: twitch.tv/{saved}</div>}
			{error && <div className="text-xs text-red-200">{error}</div>}
		</section>
	);
}
