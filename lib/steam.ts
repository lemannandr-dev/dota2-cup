// Steam OpenID 2.0 helpers. The Steam password never touches this platform:
// the user authenticates on steamcommunity.com and we verify the signed assertion.
import { createHash, randomBytes } from 'crypto';

const STEAM_OPENID_ENDPOINT = 'https://steamcommunity.com/openid/login';
const STEAM_ID_PATTERN = /^https:\/\/steamcommunity\.com\/openid\/id\/(\d{17})$/;
const DEFAULT_LOCAL_URL = 'http://localhost:3002';

function parsedOrigin(value?: string | null): URL | null {
	if (!value) return null;
	try {
		return new URL(value);
	} catch {
		return null;
	}
}

function isLocalRequest(url: URL): boolean {
	if (url.hostname === 'localhost' || url.hostname === '127.0.0.1' || url.hostname === '[::1]') return true;
	return /^(10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/.test(url.hostname);
}

export function resolveSteamBaseUrl(requestUrl?: string, configuredUrl?: string): string {
	const request = parsedOrigin(requestUrl);
	const configured = parsedOrigin(configuredUrl);

	if (!configured) return request?.origin ?? DEFAULT_LOCAL_URL;
	if (!request) return configured.origin;

	// Local Docker maps the internal :3000 process to :3002. The browser-facing
	// origin is authoritative in development, otherwise Steam returns to :3000.
	if (isLocalRequest(request) && isLocalRequest(configured)) return request.origin;
	return configured.origin;
}

export function getBaseUrl(requestUrl?: string): string {
	return resolveSteamBaseUrl(requestUrl, process.env.APP_URL || process.env.NEXTAUTH_URL);
}

function firstForwardedValue(value: string | null): string | null {
	return value?.split(',')[0]?.trim() || null;
}

export function getRequestBaseUrl(request: { url: string; headers: Headers }): string {
	const host = firstForwardedValue(request.headers.get('x-forwarded-host')) || request.headers.get('host');
	const forwardedProtocol = firstForwardedValue(request.headers.get('x-forwarded-proto'));
	const fallbackProtocol = parsedOrigin(request.url)?.protocol.replace(':', '') || 'http';
	const requestUrl = host ? `${forwardedProtocol || fallbackProtocol}://${host}` : request.url;
	return getBaseUrl(requestUrl);
}

export function buildSteamLoginUrl(returnPath = '/api/auth/steam/callback', requestUrl?: string): string {
	const base = getBaseUrl(requestUrl);
	const params = new URLSearchParams({
		'openid.ns': 'http://specs.openid.net/auth/2.0',
		'openid.mode': 'checkid_setup',
		'openid.return_to': `${base}${returnPath}`,
		'openid.realm': base,
		'openid.identity': 'http://specs.openid.net/auth/2.0/identifier_select',
		'openid.claimed_id': 'http://specs.openid.net/auth/2.0/identifier_select'
	});
	return `${STEAM_OPENID_ENDPOINT}?${params.toString()}`;
}

// Verifies the OpenID assertion directly with Steam (check_authentication).
export async function verifySteamAssertion(query: URLSearchParams, expectedReturnTo?: string): Promise<string | null> {
	const claimedId = query.get('openid.claimed_id') || '';
	const match = claimedId.match(STEAM_ID_PATTERN);
	if (!match) return null;
	if (query.get('openid.mode') !== 'id_res') return null;
	if (expectedReturnTo && query.get('openid.return_to') !== expectedReturnTo) return null;
	if (query.get('openid.op_endpoint') !== STEAM_OPENID_ENDPOINT) return null;
	const signed = new Set((query.get('openid.signed') || '').split(','));
	if (!['claimed_id', 'identity', 'return_to', 'response_nonce', 'op_endpoint'].every((field) => signed.has(field))) return null;
	if (query.get('openid.identity') !== claimedId) return null;

	const body = new URLSearchParams();
	query.forEach((value, key) => {
		if (key.startsWith('openid.')) body.set(key, value);
	});
	body.set('openid.mode', 'check_authentication');

	const res = await fetch(STEAM_OPENID_ENDPOINT, {
		method: 'POST',
		headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
		body: body.toString(),
		signal: AbortSignal.timeout(12000)
	});
	if (!res.ok) return null;
	const text = await res.text();
	if (!/is_valid\s*:\s*true/.test(text)) return null;

	return match[1];
}

export function generateSessionToken(): string {
	return randomBytes(32).toString('hex');
}

export function hashToken(token: string): string {
	return createHash('sha256').update(token).digest('hex');
}

export function steam64ToAccountId(steamId64: string): number | null {
	try {
		const accountId = BigInt(steamId64) - 76561197960265728n;
		if (accountId <= 0n || accountId > 4294967295n) return null;
		return Number(accountId);
	} catch {
		return null;
	}
}

// Optional profile enrichment; degrades gracefully without an API key.
export async function fetchSteamProfile(steamId64: string): Promise<{ personaName?: string; avatar?: string } | null> {
	const key = process.env.STEAM_API_KEY;
	if (!key) return null;
	try {
		const url = `https://api.steampowered.com/ISteamUser/GetPlayerSummaries/v2/?key=${key}&steamids=${steamId64}`;
		const res = await fetch(url, { signal: AbortSignal.timeout(5000) });
		if (!res.ok) return null;
		const data = await res.json();
		const p = data?.response?.players?.[0];
		if (!p) return null;
		return { personaName: p.personaname, avatar: p.avatarfull };
	} catch {
		return null;
	}
}
