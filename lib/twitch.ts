const LOGIN = /^[a-zA-Z0-9_]{4,25}$/;

export function parseTwitchLogin(value?: string | null): string | null {
	if (!value) return null;
	const trimmed = value.trim();
	const fromUrl = trimmed.match(/(?:https?:\/\/)?(?:www\.|m\.)?twitch\.tv\/([a-zA-Z0-9_]+)/i);
	const raw = (fromUrl?.[1] ?? trimmed.replace(/^@/, '').replace(/^stream:/i, '')).split(/[/?#\s]/)[0] ?? '';
	const login = raw.toLowerCase();
	return LOGIN.test(login) ? login : null;
}

export function collectTwitchLogins(...chunks: Array<string | null | undefined>): string[] {
	const found = new Set<string>();
	for (const chunk of chunks) {
		if (!chunk) continue;
		const streamLine = chunk.match(/(?:^|\n)stream:([a-zA-Z0-9_]+)/i);
		if (streamLine) {
			const login = parseTwitchLogin(streamLine[1]);
			if (login) found.add(login);
		}
		for (const match of chunk.matchAll(/(?:https?:\/\/)?(?:www\.|m\.)?twitch\.tv\/([a-zA-Z0-9_]+)/gi)) {
			const login = parseTwitchLogin(match[1]);
			if (login) found.add(login);
		}
		const plain = parseTwitchLogin(chunk);
		if (plain && !chunk.includes(' ') && !chunk.includes('\n')) found.add(plain);
	}
	return [...found];
}

export function withStreamRule(rules: string | undefined, login: string | undefined) {
	const parsed = parseTwitchLogin(login);
	const without = (rules ?? '').replace(/(?:^|\n)stream:[a-zA-Z0-9_]+\n?/gi, '').trim();
	if (!parsed) return without || undefined;
	return [`stream:${parsed}`, without].filter(Boolean).join('\n');
}

export function twitchPlayerSrc(login: string, parent = 'localhost') {
	const params = new URLSearchParams({
		channel: login,
		parent,
		muted: 'true',
		autoplay: 'true'
	});
	return `https://player.twitch.tv/?${params.toString()}`;
}
