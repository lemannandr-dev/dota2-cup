import { NextResponse } from 'next/server';
import { getCurrentSteamUser } from '@/lib/steam-session';
import { searchLobbyPeople } from '@/server/lobby/chat';
import { assertRateLimit } from '@/server/rate-limit';
import { toErrorResponse } from '@/server/errors';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
	const user = await getCurrentSteamUser();
	if (!user?.steamId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
	try {
		await assertRateLimit(`lobby-people:${user.id}`, 40, 60);
		const q = new URL(request.url).searchParams.get('q') || '';
		const people = await searchLobbyPeople(q, user.id);
		return NextResponse.json({ people });
	} catch (error) {
		const mapped = toErrorResponse(error);
		return NextResponse.json({ error: mapped.error }, { status: mapped.status });
	}
}
