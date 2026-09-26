import { getCurrentSteamUser } from '@/server/auth/session';
import { isStandAdmin } from '@/lib/stand-admin';

export async function requireAdmin() {
	const user = await getCurrentSteamUser();
	if (!user || !isStandAdmin(user)) {
		return { ok: false as const };
	}
	return { ok: true as const, user };
}
