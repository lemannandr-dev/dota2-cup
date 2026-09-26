import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { safeAuthReturn, steamLoginHref } from '@/lib/auth-return';
import { hashToken } from '@/lib/steam';

const mocked = vi.hoisted(() => ({
	verify: vi.fn(), profile: vi.fn(), findUser: vi.fn(), updateUser: vi.fn(), transaction: vi.fn(),
	session: vi.fn(), audit: vi.fn(), cleanup: vi.fn(), createFlow: vi.fn(), consumeFlow: vi.fn()
}));
vi.mock('@/lib/prisma', () => ({ prisma: {
	user: { findUnique: mocked.findUser, update: mocked.updateUser },
	session: { create: mocked.session, deleteMany: mocked.cleanup },
	verificationToken: { create: mocked.createFlow, deleteMany: mocked.consumeFlow },
	auditLog: { create: mocked.audit }, $transaction: mocked.transaction
} }));
vi.mock('@/lib/steam', async (original) => ({ ...await original<typeof import('@/lib/steam')>(), verifySteamAssertion: mocked.verify, fetchSteamProfile: mocked.profile }));
vi.mock('@/lib/user-id-generator', () => ({ generateUserId: vi.fn() }));
import { GET as start } from '@/app/api/auth/steam/route';
import { GET as callback } from '@/app/api/auth/steam/callback/route';

beforeEach(() => {
	vi.stubEnv('APP_URL', 'http://localhost:3000');
	vi.clearAllMocks();
	mocked.verify.mockResolvedValue('76561198000000001');
	mocked.profile.mockResolvedValue(null);
	mocked.findUser.mockResolvedValue({ id: 'p1', displayName: 'Player', avatarUrl: null });
	mocked.updateUser.mockResolvedValue({ id: 'p1' });
	mocked.createFlow.mockResolvedValue({});
	mocked.consumeFlow.mockResolvedValue({ count: 1 });
});
afterEach(() => vi.unstubAllEnvs());

describe('Steam mobile return', () => {
	it.each(['//evil.test', '/\\evil.test', '/%5cevil.test', '/api/auth/steam', '/login', '/%0aevil', 'https://evil.test', '/%ff'])('rejects unsafe return %s', (next) => {
		expect(safeAuthReturn(next)).toBe('/home');
	});
	it('preserves invite query and local browser port', async () => {
		const next = '/party-search?join=abcd&tab=players';
		const res = await start(new NextRequest(`http://10.0.2.2:3002${steamLoginHref(next)}`, { headers: { host: '10.0.2.2:3002' } }));
		const url = new URL(res.headers.get('location')!);
		const returnTo = new URL(url.searchParams.get('openid.return_to')!);
		expect(returnTo.origin).toBe('http://10.0.2.2:3002');
		expect(url.searchParams.get('openid.realm')).toBe(returnTo.origin);
		const flow = JSON.parse(res.cookies.get('aegis_steam_flow')!.value);
		expect(flow).toMatchObject({ next, state: returnTo.searchParams.get('state') });
		expect(flow.binding).toHaveLength(64);
		expect(url.href).not.toContain(flow.binding);
		expect(mocked.createFlow).toHaveBeenCalledWith({ data: { identifier: `steam:${hashToken(flow.state)}`, token: hashToken(flow.binding), expires: expect.any(Date) } });
		expect(res.headers.get('set-cookie')).toContain('HttpOnly');
	});
	it('returns verified user to the invitation and sets a usable local cookie', async () => {
		vi.stubEnv('NODE_ENV', 'production');
		const flow = { state: 'a'.repeat(64), binding: 'b'.repeat(64), next: '/party-search?invite=invite1' };
		const req = new NextRequest(`http://10.0.2.2:3002/api/auth/steam/callback?state=${flow.state}`, { headers: { host: '10.0.2.2:3002' } });
		req.cookies.set('aegis_steam_flow', JSON.stringify(flow));
		const res = await callback(req);
		expect(res.headers.get('location')).toBe('http://10.0.2.2:3002/party-search?invite=invite1');
		expect(res.cookies.get('aegis_session')?.value).toHaveLength(64);
		expect(res.cookies.get('aegis_session')?.secure).not.toBe(true);
		const rawCookieExpires = res.cookies.get('aegis_session')?.expires ?? 0;
		const cookieExpires = typeof rawCookieExpires === 'number' ? rawCookieExpires : rawCookieExpires.getTime();
		expect(cookieExpires - Date.now()).toBeGreaterThan(29 * 24 * 60 * 60 * 1000);
		expect(cookieExpires - Date.now()).toBeLessThan(31 * 24 * 60 * 60 * 1000);
		expect(mocked.verify).toHaveBeenCalledWith(expect.any(URLSearchParams), `http://10.0.2.2:3002/api/auth/steam/callback?state=${flow.state}`);
		expect(mocked.consumeFlow).toHaveBeenCalledWith({ where: { identifier: `steam:${hashToken(flow.state)}`, token: hashToken(flow.binding), expires: { gt: expect.any(Date) } } });
	});
	it('rejects a callback without the initiating browser state', async () => {
		const res = await callback(new NextRequest('http://localhost:3002/api/auth/steam/callback?state=wrong', { headers: { host: 'localhost:3002' } }));
		expect(res.headers.get('location')).toContain('/login?error=expired');
		expect(mocked.verify).not.toHaveBeenCalled();
		expect(res.cookies.get('aegis_session')).toBeUndefined();
	});
	it('shows cancellation without losing the invitation', async () => {
		const req = new NextRequest(`http://localhost:3002/api/auth/steam/callback?state=${'a'.repeat(64)}&openid.mode=cancel`, { headers: { host: 'localhost:3002' } });
		req.cookies.set('aegis_steam_flow', JSON.stringify({ state: 'a'.repeat(64), binding: 'b'.repeat(64), next: '/party-search?invite=abc' }));
		const res = await callback(req);
		const url = new URL(res.headers.get('location')!);
		expect(url.searchParams.get('error')).toBe('cancelled');
		expect(url.searchParams.get('next')).toBe('/party-search?invite=abc');
		expect(mocked.verify).not.toHaveBeenCalled();
	});
	it('rejects expired or consumed server state', async () => {
		mocked.consumeFlow.mockResolvedValue({ count: 0 });
		const req = new NextRequest(`http://localhost:3002/api/auth/steam/callback?state=${'a'.repeat(64)}`);
		req.cookies.set('aegis_steam_flow', JSON.stringify({ state: 'a'.repeat(64), binding: 'b'.repeat(64), next: '/party-search?invite=abc' }));
		const res = await callback(req);
		expect(res.headers.get('location')).toContain('/login?error=expired');
		expect(mocked.verify).not.toHaveBeenCalled();
		expect(mocked.session).not.toHaveBeenCalled();
	});
	it('does not authenticate a second callback with the same cookie', async () => {
		mocked.consumeFlow.mockResolvedValueOnce({ count: 1 }).mockResolvedValueOnce({ count: 0 });
		const req = new NextRequest(`http://localhost:3002/api/auth/steam/callback?state=${'a'.repeat(64)}`);
		req.cookies.set('aegis_steam_flow', JSON.stringify({ state: 'a'.repeat(64), binding: 'b'.repeat(64) }));
		await callback(req);
		const replay = await callback(req);
		expect(replay.headers.get('location')).toContain('/login?error=expired');
		expect(mocked.session).toHaveBeenCalledTimes(1);
		expect(mocked.verify).toHaveBeenCalledTimes(1);
	});
	it('rejects a URL state without the private browser binding', async () => {
		const req = new NextRequest(`http://localhost:3002/api/auth/steam/callback?state=${'a'.repeat(64)}`);
		req.cookies.set('aegis_steam_flow', JSON.stringify({ state: 'a'.repeat(64) }));
		const res = await callback(req);
		expect(res.headers.get('location')).toContain('/login?error=expired');
		expect(mocked.consumeFlow).not.toHaveBeenCalled();
		expect(mocked.verify).not.toHaveBeenCalled();
	});
	it('handles malformed return data without throwing', async () => {
		const req = new NextRequest('http://localhost:3002/api/auth/steam/callback');
		req.cookies.set('aegis_steam_flow', JSON.stringify({ next: 123 }));
		const res = await callback(req);
		expect(new URL(res.headers.get('location')!).searchParams.get('next')).toBe('/home');
	});
	it('offers retry when server state cannot be stored', async () => {
		mocked.createFlow.mockRejectedValueOnce(new Error('database unavailable'));
		const res = await start(new NextRequest('http://localhost:3002/api/auth/steam?next=%2Fparty-search'));
		const url = new URL(res.headers.get('location')!);
		expect(url.pathname).toBe('/login');
		expect(url.searchParams.get('error')).toBe('unavailable');
		expect(url.searchParams.get('next')).toBe('/party-search');
	});
});
