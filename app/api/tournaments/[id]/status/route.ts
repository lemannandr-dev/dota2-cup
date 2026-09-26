import { NextRequest, NextResponse } from 'next/server';
import { getCurrentSteamUser } from '@/server/auth/session';
import { transitionTournamentStatus } from '@/server/tournaments/publish';
import { isTournamentStaff } from '@/server/tournaments/staff';
import { publishTournamentEvent } from '@/server/realtime/publish';
import { toErrorResponse } from '@/server/errors';
import { z } from 'zod';

const schema = z.object({
	status: z.enum(['REGISTRATION', 'CHECK_IN', 'LIVE', 'FINISHED', 'CANCELLED']),
	confirm: z.boolean().optional()
});

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
	const { id } = await params;
	const user = await getCurrentSteamUser();
	if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
	if (!(await isTournamentStaff(user.id, user.role, id))) {
		return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
	}
	const parsed = schema.safeParse(await req.json());
	if (!parsed.success) return NextResponse.json({ error: 'Некорректный статус' }, { status: 400 });
	if (parsed.data.status === 'CANCELLED' && parsed.data.confirm !== true) {
		return NextResponse.json({ error: 'Подтвердите отмену на карточке' }, { status: 400 });
	}
	try {
		const tournament = await transitionTournamentStatus(id, user.id, parsed.data.status);
		await publishTournamentEvent(id, 'tournament_updated', { status: tournament.status }).catch(() => undefined);
		return NextResponse.json({ tournament });
	} catch (error) {
		const mapped = toErrorResponse(error);
		return NextResponse.json({ error: mapped.error }, { status: mapped.status });
	}
}
