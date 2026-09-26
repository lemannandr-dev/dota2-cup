import type { User } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { fetchSteamProfile } from '@/lib/steam';

function needsSteamRefresh(user: User): boolean {
	if (!user.steamId) return false;
	if (!user.avatarUrl) return true;
	if (user.displayName.startsWith('Player ')) return true;
	return false;
}

export async function syncSteamProfileIfNeeded(user: User): Promise<User> {
	if (!needsSteamRefresh(user)) {
		return user;
	}

	const profile = await fetchSteamProfile(user.steamId as string);
	if (!profile?.personaName && !profile?.avatar) {
		return user;
	}

	const nextDisplayName = profile.personaName || user.displayName;
	const nextAvatar = profile.avatar || user.avatarUrl;

	if (nextDisplayName === user.displayName && nextAvatar === user.avatarUrl) {
		return user;
	}

	return prisma.user.update({
		where: { id: user.id },
		data: {
			displayName: nextDisplayName,
			avatarUrl: nextAvatar,
			lastLoginAt: new Date()
		}
	});
}
