import { NextRequest, NextResponse } from 'next/server';
import { ApplicationStatus } from '@prisma/client';
import { getCurrentSteamUser } from '@/server/auth/session';
import { reviewApplication } from '@/server/tournaments/review';
import { isTournamentStaff } from '@/server/tournaments/staff';
import { DomainError, toErrorResponse } from '@/server/errors';
import { assertSameOriginMutation } from '@/server/http/mutation-guards';
import { assertRateLimit } from '@/server/rate-limit';
import { publishTournamentEvent } from '@/server/realtime/publish';
import { z } from 'zod';

const schema = z.object({
	status: z.enum(['APPROVED', 'REJECTED', 'NEEDS_ACTION']),
	note: z.string().trim().max(280).optional()
});

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string; appId: string }> }) {
	const { id, appId } = await params;
	try {
		assertSameOriginMutation(req);
		const user = await getCurrentSteamUser();
		if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
		await assertRateLimit(`app-review:${user.id}`, 60, 600);
		if (!(await isTournamentStaff(user.id, user.role, id))) {
			return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
		}
		const parsed = schema.safeParse(await req.json());
		if (!parsed.success) return NextResponse.json({ error: 'Некорректное решение' }, { status: 400 });
		const application = await reviewApplication(
			id,
			appId,
			user.id,
			parsed.data.status as ApplicationStatus,
			parsed.data.note
		);
		await publishTournamentEvent(id, 'application_updated', {
			applicationId: application.id,
			status: application.status
		}).catch(() => undefined);
		return NextResponse.json({ application });
	} catch (error) {
		if (error instanceof DomainError) {
			return NextResponse.json({ error: error.message }, { status: error.status });
		}
		const mapped = toErrorResponse(error);
		return NextResponse.json({ error: mapped.error }, { status: mapped.status });
	}
}
