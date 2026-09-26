import { NextRequest, NextResponse } from 'next/server';
import { getCurrentSteamUser } from '@/server/auth/session';
import { isTournamentStaff } from '@/server/tournaments/staff';
import { cloneTournamentDraft } from '@/server/tournaments/clone';
import { toErrorResponse } from '@/server/errors';

export async function POST(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
	const { id } = await params;
	const user = await getCurrentSteamUser();
	if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
	if (!(await isTournamentStaff(user.id, user.role, id))) {
		return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
	}
	try {
		const tournament = await cloneTournamentDraft(id, user.id);
		return NextResponse.json({ tournament });
	} catch (error) {
		const mapped = toErrorResponse(error);
		return NextResponse.json({ error: mapped.error }, { status: mapped.status });
	}
}
