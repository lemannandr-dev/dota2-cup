import { NextResponse } from 'next/server';
import { EMPTY_ARENA_PULSE } from '@/lib/home-live';
import { getCurrentSteamUser } from '@/server/auth/session';
import { loadHomeLivePayload } from '@/server/home/team';

export async function GET() {
	const user = await getCurrentSteamUser();
	if (!user) {
		return NextResponse.json(
			{ cards: [], rosterGaps: [], myTeam: null, nearestOpenCup: null, arenaOnline: [], pulse: EMPTY_ARENA_PULSE },
			{ status: 200 }
		);
	}
	return NextResponse.json(await loadHomeLivePayload(user.id));
}
