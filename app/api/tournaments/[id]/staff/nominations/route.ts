import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getCurrentSteamUser } from '@/server/auth/session';
import { AmbiguousNomineeError, nominateReferee } from '@/server/tournaments/referee-ballot';
import { toErrorResponse } from '@/server/errors';

const schema = z.object({
	userId: z.string().trim().min(1).optional(),
	query: z.string().trim().min(2).max(80).optional()
}).refine((row) => Boolean(row.userId || row.query), { message: 'query' });

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
	const { id } = await params;
	const user = await getCurrentSteamUser();
	if (!user) return NextResponse.json({ error: 'Войдите через Steam' }, { status: 401 });
	const parsed = schema.safeParse(await req.json());
	if (!parsed.success) return NextResponse.json({ error: 'Напишите ник на арене' }, { status: 400 });
	try {
		const nomination = await nominateReferee(id, user.id, parsed.data);
		return NextResponse.json({ nomination });
	} catch (error) {
		if (error instanceof AmbiguousNomineeError) {
			return NextResponse.json({ error: error.message, candidates: error.choices }, { status: 409 });
		}
		const mapped = toErrorResponse(error);
		return NextResponse.json({ error: mapped.error }, { status: mapped.status });
	}
}
