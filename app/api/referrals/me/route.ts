import { NextResponse } from 'next/server';
import { getCurrentSteamUser } from '@/lib/steam-session';
import { referralShareUrl } from '@/lib/referrals';
import { siteUrl } from '@/lib/site';
import { referralDesk } from '@/server/referrals';

export const dynamic = 'force-dynamic';

export async function GET() {
	const user = await getCurrentSteamUser();
	if (!user?.steamId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
	const desk = await referralDesk(user.id);
	return NextResponse.json({
		...desk,
		url: referralShareUrl(siteUrl(), desk.code)
	});
}
