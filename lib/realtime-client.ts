/** Shared realtime helpers — keep transport thin; no rooms:join ACK yet. */

export const TOURNAMENT_LIVE_EVENTS = [
	'ready_updated',
	'lobby_updated',
	'match_report',
	'match_dispute',
	'match_completed',
	'application_updated',
	'tournament_updated'
] as const;

export type TournamentLiveEvent = (typeof TOURNAMENT_LIVE_EVENTS)[number];

export type RealtimeLiveState = 'idle' | 'connecting' | 'live' | 'degraded';

export async function isRealtimeUp(url: string) {
	try {
		const health = new URL('/health', url);
		const res = await fetch(health, { cache: 'no-store', signal: AbortSignal.timeout(1200) });
		return res.ok;
	} catch {
		return false;
	}
}

/** Unique sorted tournament ids for stable room joins. */
export function uniqueTournamentIds(ids: Array<string | null | undefined>) {
	return [...new Set(ids.filter((id): id is string => Boolean(id)))].sort();
}

/** Coalesce bursts (default 150ms per Phase A package). */
export function coalesceCalls(fn: () => void, waitMs = 150) {
	let timer: ReturnType<typeof setTimeout> | null = null;
	let dirty = false;
	let running = false;

	const run = () => {
		timer = null;
		if (running) {
			dirty = true;
			return;
		}
		running = true;
		dirty = false;
		try {
			fn();
		} finally {
			running = false;
			if (dirty) schedule();
		}
	};

	const schedule = () => {
		if (timer) return;
		timer = setTimeout(run, waitMs);
	};

	const trigger = () => schedule();
	trigger.cancel = () => {
		if (timer) clearTimeout(timer);
		timer = null;
		dirty = false;
	};
	return trigger;
}
