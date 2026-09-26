'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import type { HomeArenaPlayer, HomeArenaPulse, HomeLiveCard, HomeOpenCup, HomeTeamCard, RosterGap } from '@/lib/home-live';
import { EMPTY_ARENA_PULSE } from '@/lib/home-live';
import { uniqueTournamentIds } from '@/lib/realtime-client';
import { useSocketRooms } from '@/components/realtime/useSocketRooms';

const DEGRADED_POLL_MS = 60_000;

/**
 * Home live boards: socket-driven when live; 60s fallback when degraded.
 * Critique: package's full ApiResult/sessionEpoch merge skipped — keep simple setState.
 */
export function useHomeLive(
	initialCards: HomeLiveCard[],
	initialGaps: RosterGap[],
	initialTeam: HomeTeamCard | null = null,
	initialCup: HomeOpenCup | null = null,
	initialOnline: HomeArenaPlayer[] = [],
	initialPulse: HomeArenaPulse = EMPTY_ARENA_PULSE
) {
	const [cards, setCards] = useState(initialCards);
	const [rosterGaps, setRosterGaps] = useState(initialGaps);
	const [myTeam, setMyTeam] = useState(initialTeam);
	const [nearestOpenCup, setNearestOpenCup] = useState(initialCup);
	const [arenaOnline, setArenaOnline] = useState(initialOnline);
	const [pulse, setPulse] = useState(initialPulse);

	useEffect(() => {
		setCards(initialCards);
		setRosterGaps(initialGaps);
		setMyTeam(initialTeam);
		setNearestOpenCup(initialCup);
		setArenaOnline(initialOnline);
		setPulse(initialPulse);
	}, [initialCards, initialGaps, initialTeam, initialCup, initialOnline, initialPulse]);

	const tournamentIds = useMemo(
		() => uniqueTournamentIds([...cards.map((card) => card.tournamentId), nearestOpenCup?.id].filter((id): id is string => Boolean(id))),
		[cards, nearestOpenCup]
	);

	const refresh = useCallback(async () => {
		try {
			const res = await fetch('/api/home/live', { cache: 'no-store' });
			if (!res.ok) return;
			const data = await res.json();
			if (Array.isArray(data.cards)) setCards(data.cards);
			if (Array.isArray(data.rosterGaps)) setRosterGaps(data.rosterGaps);
			setMyTeam(data.myTeam ?? null);
			setNearestOpenCup(data.nearestOpenCup ?? null);
			if (Array.isArray(data.arenaOnline)) setArenaOnline(data.arenaOnline);
			if (data.pulse && Array.isArray(data.pulse.champions)) setPulse(data.pulse);
		} catch {
			/* next tick / reconnect */
		}
	}, []);

	const { liveState } = useSocketRooms(tournamentIds, {
		onEvent: () => {
			void refresh();
		},
		onReconnect: () => {
			void refresh();
		}
	});

	useEffect(() => {
		void refresh();
	}, [refresh]);

	useEffect(() => {
		function onVisible() {
			if (document.visibilityState === 'visible') void refresh();
		}
		function onOnline() {
			void refresh();
		}
		document.addEventListener('visibilitychange', onVisible);
		window.addEventListener('online', onOnline);
		return () => {
			document.removeEventListener('visibilitychange', onVisible);
			window.removeEventListener('online', onOnline);
		};
	}, [refresh]);

	useEffect(() => {
		if (liveState === 'live') return;
		const timer = window.setInterval(() => void refresh(), DEGRADED_POLL_MS);
		return () => window.clearInterval(timer);
	}, [liveState, refresh]);

	return { cards, rosterGaps, myTeam, nearestOpenCup, arenaOnline, pulse, liveState, refresh };
}
