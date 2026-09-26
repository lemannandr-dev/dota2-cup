import { NextRequest, NextResponse } from 'next/server';
import { getCurrentSteamUser } from '@/server/auth/session';
import { withdrawTeam } from '@/server/tournaments/register';
import { toErrorResponse } from '@/server/errors';
import { z } from 'zod';

const schema = z.object({ teamId: z.string().min(1) });

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
	const { id } = await params;
	const user = await getCurrentSteamUser();
	if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
	const parsed = schema.safeParse(await req.json());
	if (!parsed.success) return NextResponse.json({ error: 'teamId required' }, { status: 400 });
	try {
		const application = await withdrawTeam(id, parsed.data.teamId, user.id);
		return NextResponse.json({ application });
	} catch (error) {
		const mapped = toErrorResponse(error);
		return NextResponse.json({ error: mapped.error }, { status: mapped.status });
	}
}
