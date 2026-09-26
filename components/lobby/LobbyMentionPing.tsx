'use client';

import { useEffect, useState } from 'react';
import { io, type Socket } from 'socket.io-client';
import { hearLobbyMention, warmLobbyChime } from '@/components/lobby/chime';
import { resolveRealtimeUrl } from '@/lib/realtime-url';
import { isRealtimeUp } from '@/lib/realtime-client';

type Mention = { messageId?: string; fromName?: string };

export function LobbyMentionPing() {
	const [ping, setPing] = useState<{ id: string; fromName: string } | null>(null);

	useEffect(() => {
		let cancelled = false;
		const holder: { socket: Socket | null } = { socket: null };
		const arm = () => warmLobbyChime();
		window.addEventListener('pointerdown', arm);

		void (async () => {
			const ticketRes = await fetch('/api/lobby/chat', { cache: 'no-store' });
			if (!ticketRes.ok || cancelled) return;
			const payload = (await ticketRes.json()) as { ticket?: string | null };
			if (!payload.ticket || cancelled) return;
			const url = resolveRealtimeUrl(process.env.NEXT_PUBLIC_SOCKET_URL, window.location.href);
			if (!url || !(await isRealtimeUp(url)) || cancelled) return;
			const socket = io(url, {
				transports: ['websocket'],
				reconnection: true,
				reconnectionAttempts: 8,
				reconnectionDelay: 800,
				timeout: 2000,
				auth: { ticket: payload.ticket }
			});
			holder.socket = socket;
			socket.on('lobby:mention', (event: Mention) => {
				const id = typeof event?.messageId === 'string' ? event.messageId : '';
				if (!hearLobbyMention(id)) return;
				setPing({ id, fromName: typeof event?.fromName === 'string' ? event.fromName : 'Игрок' });
			});
		})();

		return () => {
			cancelled = true;
			window.removeEventListener('pointerdown', arm);
			holder.socket?.disconnect();
		};
	}, []);

	useEffect(() => {
		if (!ping) return;
		const timer = window.setTimeout(() => setPing(null), 12000);
		return () => window.clearTimeout(timer);
	}, [ping]);

	if (!ping) return null;
	return (
		<a
			href="/home#lobby-chat"
			data-lobby-chime="played"
			className="fixed right-4 top-[4.75rem] z-[80] max-w-xs rounded-card border border-aegis/50 bg-ink/95 px-3.5 py-3 text-sm text-cream shadow-xl"
		>
			<span className="block text-[10px] uppercase tracking-[0.14em] text-aegisSoft">Сообщение для вас</span>
			<span className="mt-1 block">{ping.fromName} отметил вас в чате арены</span>
		</a>
	);
}
