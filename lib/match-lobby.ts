export type MatchLobby = {
	name: string;
	password: string | null;
	region: string | null;
	hostName: string | null;
	voiceUrl: string | null;
	playing: boolean;
	postedAt: string | null;
};

export function parseMatchLobby(raw: unknown): MatchLobby | null {
	if (!raw || typeof raw !== 'object') return null;
	const row = raw as Record<string, unknown>;
	if (typeof row.name !== 'string' || row.name.trim().length < 2) return null;
	return {
		name: row.name.trim().slice(0, 40),
		password: typeof row.password === 'string' && row.password.trim() ? row.password.trim().slice(0, 32) : null,
		region: typeof row.region === 'string' && row.region.trim() ? row.region.trim().slice(0, 40) : null,
		hostName: typeof row.hostName === 'string' && row.hostName.trim() ? row.hostName.trim().slice(0, 40) : null,
		voiceUrl: typeof row.voiceUrl === 'string' && isAllowedVoiceUrl(row.voiceUrl) ? row.voiceUrl.trim() : null,
		playing: row.playing === true,
		postedAt: typeof row.postedAt === 'string' ? row.postedAt : null
	};
}

export function writeMatchLobby(input: {
	name: string;
	password?: string | null;
	region?: string | null;
	hostName?: string | null;
	voiceUrl?: string | null;
	playing?: boolean;
}): MatchLobby {
	const parsed = parseMatchLobby({
		...input,
		playing: Boolean(input.playing),
		postedAt: new Date().toISOString()
	});
	if (!parsed) {
		throw new Error('Укажите имя лобби');
	}
	return parsed;
}

export function publicMatchLobby(lobby: MatchLobby | null, canSeeSecrets: boolean): MatchLobby | null {
	if (!lobby) return null;
	if (canSeeSecrets) return lobby;
	return { ...lobby, password: null, voiceUrl: null };
}

export function isAllowedVoiceUrl(raw: string) {
	try {
		const url = new URL(raw);
		if (url.protocol !== 'https:') return false;
		const host = url.hostname.toLowerCase();
		return (
			host === 'discord.gg' ||
			host === 'discord.com' ||
			host === 'www.discord.com' ||
			host === 't.me' ||
			host === 'telegram.me' ||
			host === 'www.telegram.me'
		);
	} catch {
		return false;
	}
}

export function canPostMatchLobby(
	userId: string,
	captainAId?: string | null,
	captainBId?: string | null,
	isStaff = false,
	deputyAId?: string | null,
	deputyBId?: string | null
) {
	return isStaff || userId === captainAId || userId === captainBId || userId === deputyAId || userId === deputyBId;
}

export function canViewMatchLobby(userId: string, memberIds: Array<string | null | undefined>, isStaff = false) {
	if (isStaff) return true;
	return memberIds.some((id) => id === userId);
}

export function lobbyCopyText(input: {
	name: string;
	password?: string | null;
	region?: string | null;
	voiceUrl?: string | null;
}) {
	return [
		`Лобби: ${input.name}`,
		input.password ? `Пароль: ${input.password}` : null,
		input.region ? `Сервер: ${input.region}` : null,
		input.voiceUrl ? `Голосовой: ${input.voiceUrl}` : null
	]
		.filter(Boolean)
		.join('\n');
}
