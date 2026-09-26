import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getCurrentSteamUser } from '@/server/auth/session';
import { voteReferee } from '@/server/tournaments/referee-ballot';
import { toErrorResponse } from '@/server/errors';

const schema = z.object({
	nominationId: z.string().trim().min(1)
});

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
	const { id } = await params;
	const user = await getCurrentSteamUser();
	if (!user) return NextResponse.json({ error: 'Войдите через Steam' }, { status: 401 });
	const parsed = schema.safeParse(await req.json());
	if (!parsed.success) return NextResponse.json({ error: 'Выберите кандидата' }, { status: 400 });
	try {
		await voteReferee(id, user.id, parsed.data.nominationId);
		return NextResponse.json({ ok: true });
	} catch (error) {
		const mapped = toErrorResponse(error);
		return NextResponse.json({ error: mapped.error }, { status: mapped.status });
	}
}
