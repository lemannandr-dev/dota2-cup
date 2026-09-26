import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifySteamAssertion, fetchSteamProfile, generateSessionToken, getRequestBaseUrl, hashToken } from '@/lib/steam';
import { SESSION_COOKIE } from '@/server/auth/session';
import { generateUserId } from '@/lib/user-id-generator';
import { safeAuthReturn } from '@/lib/auth-return';
import { REFERRAL_COOKIE } from '@/lib/referrals';
import { attachReferral } from '@/server/referrals';

const SESSION_TTL_MS = 1000 * 60 * 60 * 24 * 30; // 30 days

export async function GET(req: NextRequest) {
	const base = getRequestBaseUrl(req);
	let flow: { state?: string; next?: string; binding?: string } = {};
	try { flow = JSON.parse(req.cookies.get('aegis_steam_flow')?.value || '{}') ?? {}; } catch { /* Expired or malformed flow. */ }
	const next = safeAuthReturn(flow.next);
	function failure(reason: string) {
		const target = new URL('/login', base);
		target.searchParams.set('error', reason);
		target.searchParams.set('next', next);
		const response = NextResponse.redirect(target);
		response.cookies.delete('aegis_steam_flow');
		response.headers.set('Cache-Control', 'no-store');
		return response;
	}
	try {
		if (typeof flow.state !== 'string' || typeof flow.binding !== 'string' ||
			!/^[a-f0-9]{64}$/.test(flow.state) || !/^[a-f0-9]{64}$/.test(flow.binding) ||
			flow.state !== req.nextUrl.searchParams.get('state')) return failure('expired');
		// Consume before contacting Steam: expired or replayed callbacks cannot create sessions.
		const consumed = await prisma.verificationToken.deleteMany({ where: {
			identifier: `steam:${hashToken(flow.state)}`, token: hashToken(flow.binding), expires: { gt: new Date() }
		} });
		if (consumed.count !== 1) return failure('expired');
		if (req.nextUrl.searchParams.get('openid.mode') === 'cancel') return failure('cancelled');
		const steamId64 = await verifySteamAssertion(req.nextUrl.searchParams, `${base}/api/auth/steam/callback?state=${flow.state}`);
		if (!steamId64) {
			return failure('verification');
		}

		const profile = await fetchSteamProfile(steamId64);

		let user = await prisma.user.findUnique({ where: { steamId: steamId64 } });
		const created = !user;
		if (!user) {
			const userId = await generateUserId();
			user = await prisma.user.create({
				data: {
					userId,
					steamId: steamId64,
					displayName: profile?.personaName || `Player ${steamId64.slice(-5)}`,
					avatarUrl: profile?.avatar || null,
					lastLoginAt: new Date()
				}
			});
			try {
				await attachReferral(user.id, req.cookies.get(REFERRAL_COOKIE)?.value);
			} catch (error) {
				console.error('referral attach', error);
			}
		} else {
			user = await prisma.user.update({
				where: { id: user.id },
				data: {
					lastLoginAt: new Date(),
					displayName: profile?.personaName || user.displayName,
					avatarUrl: profile?.avatar || user.avatarUrl
				}
			});
		}

		const token = generateSessionToken();
		const expires = new Date(Date.now() + SESSION_TTL_MS);
		await prisma.$transaction([
			prisma.session.deleteMany({ where: { expires: { lte: new Date() } } }),
			prisma.session.create({
				data: { sessionToken: hashToken(token), userId: user.id, expires }
			}),
			prisma.auditLog.create({
				data: { actorId: user.id, action: 'STEAM_LOGIN_SUCCEEDED', entity: 'User', entityId: user.id }
			})
		]);

		const res = NextResponse.redirect(new URL(next, base));
		res.cookies.delete('aegis_steam_flow');
		if (created) {
			res.cookies.set(REFERRAL_COOKIE, '', { httpOnly: true, sameSite: 'lax', path: '/', maxAge: 0 });
		}
		res.headers.set('Cache-Control', 'no-store');
		res.cookies.set(SESSION_COOKIE, token, {
			httpOnly: true,
			secure: base.startsWith('https:'),
			sameSite: 'lax',
			path: '/',
			expires
		});
		return res;
	} catch {
		return failure('unavailable');
	}
}
