import { NextRequest, NextResponse } from 'next/server';
import { getCurrentSteamUser } from '@/server/auth/session';
import { isTournamentStaff } from '@/server/tournaments/staff';
import { promoteWaitlistApplication } from '@/server/tournaments/waitlist-promote';
import { DomainError, toErrorResponse } from '@/server/errors';
import { assertSameOriginMutation } from '@/server/http/mutation-guards';
import { assertRateLimit } from '@/server/rate-limit';

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string; appId: string }> }) {
	const { id, appId } = await params;
	try {
		assertSameOriginMutation(req);
		const user = await getCurrentSteamUser();
		if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
		await assertRateLimit(`app-promote:${user.id}`, 30, 600);
		if (!(await isTournamentStaff(user.id, user.role, id))) {
			return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
		}
		const application = await promoteWaitlistApplication(id, appId, user.id);
		return NextResponse.json({ application });
	} catch (error) {
		if (error instanceof DomainError) {
			return NextResponse.json({ error: error.message }, { status: error.status });
		}
		const mapped = toErrorResponse(error);
		return NextResponse.json({ error: mapped.error }, { status: mapped.status });
	}
}
