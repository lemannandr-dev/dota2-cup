import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getCurrentSteamUser } from '@/server/auth/session';
import { isTournamentStaff } from '@/server/tournaments/staff';
import { remindTournamentApplications } from '@/server/tournaments/remind-applications';
import { DomainError, toErrorResponse } from '@/server/errors';
import { assertSameOriginMutation } from '@/server/http/mutation-guards';
import { assertRateLimit } from '@/server/rate-limit';

const schema = z.object({
	kind: z.enum(['check_in', 'ready', 'needs_action', 'start_soon'])
});

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
	const { id } = await params;
	try {
		assertSameOriginMutation(req);
		const user = await getCurrentSteamUser();
		if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
		await assertRateLimit(`app-remind:${user.id}:${id}`, 12, 600);
		if (!(await isTournamentStaff(user.id, user.role, id))) {
			return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
		}
		const parsed = schema.safeParse(await req.json());
		if (!parsed.success) return NextResponse.json({ error: 'Укажите тип напоминания' }, { status: 400 });
		const result = await remindTournamentApplications(id, user.id, parsed.data.kind);
		return NextResponse.json(result);
	} catch (error) {
		if (error instanceof DomainError) {
			return NextResponse.json({ error: error.message }, { status: error.status });
		}
		const mapped = toErrorResponse(error);
		return NextResponse.json({ error: mapped.error }, { status: mapped.status });
	}
}
