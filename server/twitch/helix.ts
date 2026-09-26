import { parseTwitchLogin } from '@/lib/twitch';

type TokenCache = { accessToken: string; expiresAt: number };

let tokenCache: TokenCache | null = null;

export type TwitchLiveStream = {
	login: string;
	userName: string;
	title: string;
	viewerCount: number;
	startedAt: string;
	thumbnailUrl: string;
	gameName: string;
};

function twitchConfigured() {
	return Boolean(process.env.TWITCH_CLIENT_ID && process.env.TWITCH_CLIENT_SECRET);
}

async function getAppAccessToken() {
	if (!twitchConfigured()) return null;
	if (tokenCache && tokenCache.expiresAt > Date.now() + 30_000) return tokenCache.accessToken;
	const body = new URLSearchParams({
		client_id: process.env.TWITCH_CLIENT_ID as string,
		client_secret: process.env.TWITCH_CLIENT_SECRET as string,
		grant_type: 'client_credentials'
	});
	const res = await fetch('https://id.twitch.tv/oauth2/token', {
		method: 'POST',
		headers: { 'content-type': 'application/x-www-form-urlencoded' },
		body,
		cache: 'no-store'
	});
	if (!res.ok) return null;
	const data = (await res.json()) as { access_token?: string; expires_in?: number };
	if (!data.access_token) return null;
	tokenCache = {
		accessToken: data.access_token,
		expiresAt: Date.now() + Math.max(60, data.expires_in ?? 3600) * 1000
	};
	return tokenCache.accessToken;
}

async function helix(path: string) {
	const token = await getAppAccessToken();
	if (!token || !process.env.TWITCH_CLIENT_ID) return null;
	const res = await fetch(`https://api.twitch.tv/helix${path}`, {
		headers: {
			'Client-Id': process.env.TWITCH_CLIENT_ID,
			Authorization: `Bearer ${token}`
		},
		cache: 'no-store'
	});
	if (!res.ok) return null;
	return res.json();
}

export async function lookupTwitchUser(login: string) {
	const parsed = parseTwitchLogin(login);
	if (!parsed) return null;
	if (!twitchConfigured()) return { login: parsed, displayName: parsed, id: null as string | null };
	const data = await helix(`/users?login=${encodeURIComponent(parsed)}`);
	const user = data?.data?.[0] as { id?: string; login?: string; display_name?: string } | undefined;
	if (!user?.login) return null;
	return { login: user.login, displayName: user.display_name ?? user.login, id: user.id ?? null };
}

export async function fetchLiveStreams(logins: string[]): Promise<TwitchLiveStream[]> {
	const unique = [...new Set(logins.map((login) => parseTwitchLogin(login)).filter(Boolean))] as string[];
	if (!unique.length || !twitchConfigured()) return [];
	const query = unique.map((login) => `user_login=${encodeURIComponent(login)}`).join('&');
	const data = await helix(`/streams?${query}&first=20`);
	const rows = Array.isArray(data?.data) ? data.data : [];
	return rows
		.filter((row: { type?: string }) => row.type === 'live')
		.map((row: {
			user_login?: string;
			user_name?: string;
			title?: string;
			viewer_count?: number;
			started_at?: string;
			thumbnail_url?: string;
			game_name?: string;
		}) => ({
			login: (row.user_login ?? '').toLowerCase(),
			userName: row.user_name ?? row.user_login ?? '',
			title: row.title ?? 'Прямой эфир',
			viewerCount: Number(row.viewer_count ?? 0),
			startedAt: row.started_at ?? new Date().toISOString(),
			thumbnailUrl: (row.thumbnail_url ?? '').replace('{width}', '640').replace('{height}', '360'),
			gameName: row.game_name ?? 'Dota 2'
		}))
		.filter((row: TwitchLiveStream) => row.login);
}
