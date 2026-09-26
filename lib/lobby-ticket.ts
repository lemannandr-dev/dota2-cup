import { createHmac, timingSafeEqual } from 'crypto';

export type LobbyTicket = {
	sub: string;
	name: string;
	avatar: string | null;
	exp: number;
};

const TICKET_TTL_MS = 6 * 60 * 60 * 1000;

export function signLobbyTicket(user: { id: string; displayName: string; avatarUrl: string | null }, secret: string, now = Date.now()) {
	if (!secret || !/^[a-z0-9]{8,40}$/.test(user.id)) return null;
	const ticket: LobbyTicket = {
		sub: user.id,
		name: user.displayName.replace(/[\u0000-\u001F]/g, '').trim().slice(0, 32) || 'Игрок',
		avatar: user.avatarUrl && user.avatarUrl.length <= 300 ? user.avatarUrl : null,
		exp: now + TICKET_TTL_MS
	};
	const payload = Buffer.from(JSON.stringify(ticket)).toString('base64url');
	const sig = createHmac('sha256', secret).update(payload).digest('base64url');
	return `${payload}.${sig}`;
}

export function readLobbyTicket(token: string, secret: string, now = Date.now()): LobbyTicket | null {
	if (!secret || typeof token !== 'string') return null;
	const dot = token.indexOf('.');
	if (dot <= 0 || dot !== token.lastIndexOf('.')) return null;
	const payload = token.slice(0, dot);
	const sig = token.slice(dot + 1);
	if (!payload || !sig || payload.length > 800 || sig.length > 200) return null;
	const expected = createHmac('sha256', secret).update(payload).digest('base64url');
	const given = Buffer.from(sig);
	const wanted = Buffer.from(expected);
	if (given.length !== wanted.length || !timingSafeEqual(given, wanted)) return null;
	try {
		const data = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')) as Partial<LobbyTicket>;
		if (!data || typeof data.sub !== 'string' || !/^[a-z0-9]{8,40}$/.test(data.sub)) return null;
		if (typeof data.name !== 'string' || data.name.length < 1 || data.name.length > 32) return null;
		if (typeof data.exp !== 'number' || data.exp < now) return null;
		const avatar = typeof data.avatar === 'string' && data.avatar.length <= 300 ? data.avatar : null;
		return { sub: data.sub, name: data.name, avatar, exp: data.exp };
	} catch {
		return null;
	}
}
