import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { isReferralCode, REFERRAL_COOKIE } from '@/lib/referrals';

const REFERRAL_MAX_AGE = 60 * 60 * 24 * 30;

function isGuarded(pathname: string) {
	return pathname.startsWith('/profile') || pathname.startsWith('/balance') || pathname.startsWith('/admin') || pathname.startsWith('/api/admin');
}

function withReferralCookie(req: NextRequest, response: NextResponse) {
	const code = req.nextUrl.searchParams.get('ref')?.trim().toLowerCase() ?? '';
	if (!isReferralCode(code)) return response;
	response.cookies.set(REFERRAL_COOKIE, code, {
		httpOnly: true,
		sameSite: 'lax',
		secure: req.nextUrl.protocol === 'https:',
		path: '/',
		maxAge: REFERRAL_MAX_AGE
	});
	return response;
}

export async function middleware(req: NextRequest) {
	if (isGuarded(req.nextUrl.pathname)) {
		const hasSteamSession = Boolean(req.cookies.get('aegis_session')?.value);
		if (!hasSteamSession) {
			if (req.nextUrl.pathname.startsWith('/api/')) {
				return withReferralCookie(req, NextResponse.json({ error: 'Unauthorized' }, { status: 401 }));
			}
			const homeUrl = req.nextUrl.clone();
			homeUrl.pathname = '/';
			homeUrl.search = '';
			return withReferralCookie(req, NextResponse.redirect(homeUrl));
		}
	}
	return withReferralCookie(req, NextResponse.next());
}

export const config = {
	matcher: ['/profile/:path*', '/balance/:path*', '/admin/:path*', '/api/admin/:path*', '/', '/home', '/login', '/tournaments/:path*', '/teams/:path*', '/party-search/:path*', '/heroes/:path*', '/players/:path*']
};
