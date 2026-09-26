'use client';

import { useRouter } from 'next/navigation';
import { useCallback } from 'react';
import { useSocketRooms } from '@/components/realtime/useSocketRooms';

/** Thin wrapper: one tournament room → coalesced router.refresh. */
export function useTournamentLive(tournamentId: string) {
	const router = useRouter();
	const refresh = useCallback(() => router.refresh(), [router]);
	useSocketRooms(tournamentId ? [tournamentId] : [], {
		onEvent: refresh,
		onReconnect: refresh
	});
}
