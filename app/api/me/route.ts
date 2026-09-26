import { NextRequest, NextResponse } from 'next/server';
import { syncSteamProfileIfNeeded } from '@/lib/steam-profile-sync';
import { getSteamSessionByToken, SESSION_COOKIE } from '@/lib/steam-session';
import { prisma } from '@/lib/prisma';

export async function GET(req: NextRequest) {
	const token = req.cookies.get(SESSION_COOKIE)?.value;
	if (!token) {
		return NextResponse.json({ user: null }, { status: 200 });
	}

	const session = await getSteamSessionByToken(token);
	if (!session) {
		const res = NextResponse.json({ user: null }, { status: 200 });
		res.cookies.set(SESSION_COOKIE, '', {
			httpOnly: true,
			secure: process.env.NODE_ENV === 'production',
			sameSite: 'lax',
			path: '/',
			expires: new Date(0)
		});
		return res;
	}

	const syncedUser = await syncSteamProfileIfNeeded(session.user);
	const user = await prisma.user.update({
		where: { id: syncedUser.id },
		data: { lastLoginAt: new Date() }
	});
	return NextResponse.json({
		user: {
			id: user.id,
			userId: user.userId,
			displayName: user.displayName,
			avatarUrl: user.avatarUrl,
			username: user.username,
			role: user.role
		}
	}, { status: 200 });
}
