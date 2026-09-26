import { NextRequest, NextResponse } from 'next/server';
import { buildSteamLoginUrl, generateSessionToken, getRequestBaseUrl, hashToken } from '@/lib/steam';
import { safeAuthReturn } from '@/lib/auth-return';
import { prisma } from '@/lib/prisma';

const STEAM_FLOW_COOKIE = 'aegis_steam_flow';

export async function GET(req: NextRequest) {
	const base = getRequestBaseUrl(req);
	const state = generateSessionToken();
	const binding = generateSessionToken();
	const next = safeAuthReturn(req.nextUrl.searchParams.get('next'));
	try {
		await prisma.verificationToken.deleteMany({ where: { identifier: { startsWith: 'steam:' }, expires: { lte: new Date() } } });
		await prisma.verificationToken.create({ data: {
			identifier: `steam:${hashToken(state)}`, token: hashToken(binding), expires: new Date(Date.now() + 600000)
		} });
	} catch {
		const target = new URL('/login', base);
		target.searchParams.set('error', 'unavailable');
		target.searchParams.set('next', next);
		const response = NextResponse.redirect(target);
		response.cookies.delete(STEAM_FLOW_COOKIE);
		response.headers.set('Cache-Control', 'no-store');
		return response;
	}
	const res = NextResponse.redirect(buildSteamLoginUrl(`/api/auth/steam/callback?state=${state}`, base));
	res.cookies.set(STEAM_FLOW_COOKIE, JSON.stringify({ state, next, binding }), {
		httpOnly: true, secure: base.startsWith('https:'), sameSite: 'lax', path: '/', maxAge: 600
	});
	res.headers.set('Cache-Control', 'no-store');
	return res;
}
