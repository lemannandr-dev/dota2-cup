const STEAM_ID_64_BASE = BigInt('76561197960265728');

export function steamId64ToAccountId(steamId64: string | null | undefined): number | null {
	if (!steamId64) return null;
	try {
		const parsed = BigInt(steamId64);
		if (parsed <= STEAM_ID_64_BASE) return null;
		return Number(parsed - STEAM_ID_64_BASE);
	} catch {
		return null;
	}
}
