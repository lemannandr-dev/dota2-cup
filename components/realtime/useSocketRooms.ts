'use client';

import { useEffect, useRef, useState } from 'react';
import { io, type Socket } from 'socket.io-client';
import { resolveRealtimeUrl } from '@/lib/realtime-url';
import {
	TOURNAMENT_LIVE_EVENTS,
	coalesceCalls,
	isRealtimeUp,
	uniqueTournamentIds,
	type RealtimeLiveState
} from '@/lib/realtime-client';

type Options = {
	onEvent?: () => void;
	onReconnect?: () => void;
	coalesceMs?: number;
};

/**
 * Join `tournament:{id}` rooms. Critique vs package: keep string `join` (no ACK protocol),
 * but add reconnection + 150ms coalesce + live/degraded state for Home poll gating.
 */
export function useSocketRooms(tournamentIds: string[], options: Options = {}) {
	const [liveState, setLiveState] = useState<RealtimeLiveState>('idle');
	const idsKey = uniqueTournamentIds(tournamentIds).join(',');
	const onEventRef = useRef(options.onEvent);
	const onReconnectRef = useRef(options.onReconnect);
	onEventRef.current = options.onEvent;
	onReconnectRef.current = options.onReconnect;
	const coalesceMs = options.coalesceMs ?? 150;

	useEffect(() => {
		const ids = uniqueTournamentIds(idsKey ? idsKey.split(',') : []);
		const url = resolveRealtimeUrl(process.env.NEXT_PUBLIC_SOCKET_URL, window.location.href);
		if (!url || ids.length === 0) {
			setLiveState('idle');
			return;
		}

		let cancelled = false;
		let socket: Socket | null = null;
		let sawConnect = false;
		const refresh = coalesceCalls(() => onEventRef.current?.(), coalesceMs);

		void (async () => {
			setLiveState('connecting');
			if (!(await isRealtimeUp(url)) || cancelled) {
				if (!cancelled) setLiveState('degraded');
				return;
			}
			socket = io(url, {
				transports: ['websocket'],
				reconnection: true,
				reconnectionAttempts: 8,
				reconnectionDelay: 800,
				timeout: 2000
			});

			const joinAll = () => {
				for (const id of ids) socket?.emit('join', `tournament:${id}`);
			};

			socket.on('connect', () => {
				joinAll();
				setLiveState('live');
				if (sawConnect) onReconnectRef.current?.();
				sawConnect = true;
			});
			socket.on('disconnect', () => {
				if (!cancelled) setLiveState('degraded');
			});
			socket.on('connect_error', () => {
				if (!cancelled) setLiveState('degraded');
			});

			for (const event of TOURNAMENT_LIVE_EVENTS) {
				socket.on(event, () => refresh());
			}
		})();

		return () => {
			cancelled = true;
			refresh.cancel();
			socket?.close();
			setLiveState('idle');
		};
	}, [idsKey, coalesceMs]);

	return { liveState };
}
