import { steamId64ToAccountId } from '@/lib/dota-account';
import { getCachedJson, setCachedJson } from '@/server/cache/redis';

export type RosterSteam = { steamId?: string | null };

export type VerifyResult = {
	ok: boolean;
	reason?: string;
	winnerSide?: 'radiant' | 'dire';
};

type OpenDotaMatch = {
	radiant_win?: boolean;
	players?: Array<{
		account_id?: number;
		player_slot?: number;
		ability_uses?: Record<string, number>;
	}>;
};

export async function fetchOpenDotaMatch(matchId: string): Promise<OpenDotaMatch | null> {
	const cacheKey = `od:match:${matchId}`;
	const cached = await getCachedJson<OpenDotaMatch>(cacheKey);
	if (cached) return cached;
	try {
		const res = await fetch(`https://api.opendota.com/api/matches/${matchId}`, { cache: 'no-store' });
		if (!res.ok) return null;
		const data = (await res.json()) as OpenDotaMatch;
		await setCachedJson(cacheKey, data, 600);
		return data;
	} catch {
		return null;
	}
}

export function verifyMatchRosters(
	match: OpenDotaMatch,
	teamA: RosterSteam[],
	teamB: RosterSteam[]
): VerifyResult {
	const players = match.players ?? [];
	if (players.length < 10) return { ok: false, reason: 'В катке меньше 10 игроков' };

	const radiant = new Set(
		players.filter((p) => (p.player_slot ?? 0) < 128).map((p) => p.account_id).filter((id): id is number => typeof id === 'number')
	);
	const dire = new Set(
		players.filter((p) => (p.player_slot ?? 0) >= 128).map((p) => p.account_id).filter((id): id is number => typeof id === 'number')
	);

	const idsA = teamA.map((p) => steamId64ToAccountId(p.steamId)).filter((id): id is number => id !== null);
	const idsB = teamB.map((p) => steamId64ToAccountId(p.steamId)).filter((id): id is number => id !== null);

	const aOnRadiant = idsA.filter((id) => radiant.has(id)).length;
	const aOnDire = idsA.filter((id) => dire.has(id)).length;
	const bOnRadiant = idsB.filter((id) => radiant.has(id)).length;
	const bOnDire = idsB.filter((id) => dire.has(id)).length;

	const aligned = (aOnRadiant >= 3 && bOnDire >= 3) || (aOnDire >= 3 && bOnRadiant >= 3);
	if (!aligned) return { ok: false, reason: 'Составы не совпали с OpenDota' };

	return {
		ok: true,
		winnerSide: match.radiant_win ? 'radiant' : 'dire'
	};
}
