import { NextResponse } from 'next/server';
import { getCurrentSteamUser } from '@/server/auth/session';
import { publishTournament } from '@/server/tournaments/publish';
import { isTournamentStaff } from '@/server/tournaments/staff';
import { publishTournamentEvent } from '@/server/realtime/publish';
import { toErrorResponse } from '@/server/errors';

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
	const { id } = await params;
	const user = await getCurrentSteamUser();
	if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
	if (!(await isTournamentStaff(user.id, user.role, id))) {
		return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
	}
	try {
		const tournament = await publishTournament(id, user.id);
		await publishTournamentEvent(id, 'tournament_updated', { status: tournament.status }).catch(() => undefined);
		return NextResponse.json({ tournament });
	} catch (error) {
		const mapped = toErrorResponse(error);
		return NextResponse.json({ error: mapped.error }, { status: mapped.status });
	}
}
