import { cookies } from 'next/headers';
import { prisma } from '@/lib/prisma';
import { hashToken } from '@/lib/steam';
import { syncSteamProfileIfNeeded } from '@/lib/steam-profile-sync';

export const SESSION_COOKIE = 'aegis_session';

export async function getSteamSessionByToken(token: string) {
	const tokenHash = hashToken(token);
	let session = await prisma.session.findUnique({
		where: { sessionToken: tokenHash },
		include: { user: true }
	});

	// Upgrade a legacy clear-text token in place when its owner next uses it.
	if (!session) {
		session = await prisma.session.findUnique({
			where: { sessionToken: token },
			include: { user: true }
		});
		if (session) {
			session = await prisma.session.update({
				where: { id: session.id },
				data: { sessionToken: tokenHash },
				include: { user: true }
			});
		}
	}

	if (!session || session.expires <= new Date() || !session.user.steamId) return null;
	return session;
}

/** Corridor actor. Null without `aegis_session` or without SteamID. NextAuth is not this. */
export async function getCurrentSteamUser() {
	const token = (await cookies()).get(SESSION_COOKIE)?.value;
	if (!token) return null;
	const session = await getSteamSessionByToken(token);
	if (!session?.user) return null;
	return syncSteamProfileIfNeeded(session.user);
}