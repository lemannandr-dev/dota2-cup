import { NextRequest, NextResponse } from 'next/server';
import { collectTwitchLogins } from '@/lib/twitch';
import { fetchLiveStreams } from '@/server/twitch/helix';

export async function GET(req: NextRequest) {
	const raw = req.nextUrl.searchParams.get('logins') ?? req.nextUrl.searchParams.get('channels') ?? '';
	const logins = collectTwitchLogins(...raw.split(','));
	if (!logins.length) return NextResponse.json({ streams: [], configured: Boolean(process.env.TWITCH_CLIENT_ID) });
	const streams = await fetchLiveStreams(logins);
	return NextResponse.json({
		streams,
		configured: Boolean(process.env.TWITCH_CLIENT_ID && process.env.TWITCH_CLIENT_SECRET)
	});
}
