import { publishChannel } from '@/server/cache/redis';

export async function publishTournamentEvent(tournamentId: string, type: string, payload: unknown = {}) {
	await publishChannel(`tournament:${tournamentId}`, { type, payload, at: new Date().toISOString() });
	const realtimeUrl = process.env.REALTIME_INTERNAL_URL;
	if (!realtimeUrl) return;
	try {
		await fetch(`${realtimeUrl.replace(/\/$/, '')}/emit`, {
			method: 'POST',
			headers: {
				'content-type': 'application/json',
				authorization: `Bearer ${process.env.DOTA_GC_INTERNAL_TOKEN || ''}`
			},
			body: JSON.stringify({ room: `tournament:${tournamentId}`, type, payload })
		});
	} catch {
		/* realtime server is optional */
	}
}

export async function publishRoom(room: string, type: string, payload: unknown = {}) {
	const realtimeUrl = process.env.REALTIME_INTERNAL_URL;
	if (!realtimeUrl || (!room.startsWith('lobby:') && !room.startsWith('user:'))) return;
	try {
		await fetch(`${realtimeUrl.replace(/\/$/, '')}/emit`, {
			method: 'POST',
			headers: {
				'content-type': 'application/json',
				authorization: `Bearer ${process.env.DOTA_GC_INTERNAL_TOKEN || ''}`
			},
			body: JSON.stringify({ room, type, payload })
		});
	} catch {
		/* realtime server is optional */
	}
}
