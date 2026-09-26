import { NextRequest, NextResponse } from 'next/server';
import { getCurrentSteamUser } from '@/server/auth/session';
import { swapTournamentRoster } from '@/server/tournaments/roster-swap';
import { toErrorResponse } from '@/server/errors';
import { z } from 'zod';

const schema = z.object({
	teamId: z.string().min(1),
	outUserId: z.string().min(1),
	inUserId: z.string().min(1)
});

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
	const { id: tournamentId } = await params;
	const user = await getCurrentSteamUser();
	if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
	const parsed = schema.safeParse(await req.json());
	if (!parsed.success) return NextResponse.json({ error: 'Укажите кого снимаете и кто выходит' }, { status: 400 });
	try {
		const application = await swapTournamentRoster({
			tournamentId,
			teamId: parsed.data.teamId,
			outUserId: parsed.data.outUserId,
			inUserId: parsed.data.inUserId,
			actorId: user.id,
			actorRole: user.role
		});
		return NextResponse.json({ application });
	} catch (error) {
		const mapped = toErrorResponse(error);
		return NextResponse.json({ error: mapped.error }, { status: mapped.status });
	}
}
