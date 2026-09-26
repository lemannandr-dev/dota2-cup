import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getCurrentSteamUser } from '@/lib/steam-session';
import { isSameOriginAppearanceRequest } from '@/server/appearance-request';
import { toErrorResponse } from '@/server/errors';
import { assertRateLimit } from '@/server/rate-limit';
import { listFriendBonds, requestOrAcceptFriend } from '@/server/friends';

export const dynamic = 'force-dynamic';

export async function GET() {
	const user = await getCurrentSteamUser();
	if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
	const bonds = await listFriendBonds(user.id);
	return NextResponse.json(bonds);
}

const bodySchema = z.object({ userId: z.string().trim().min(8).max(40) });

export async function POST(request: Request) {
	const user = await getCurrentSteamUser();
	if (!user || !isSameOriginAppearanceRequest(request)) {
		return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
	}
	try {
		await assertRateLimit(`friend-request:${user.id}`, 20, 600);
		const parsed = bodySchema.safeParse(await request.json());
		if (!parsed.success) return NextResponse.json({ error: 'Некорректный игрок' }, { status: 400 });
		const result = await requestOrAcceptFriend(user.id, parsed.data.userId);
		return NextResponse.json(result);
	} catch (error) {
		const mapped = toErrorResponse(error);
		return NextResponse.json({ error: mapped.error }, { status: mapped.status });
	}
}
