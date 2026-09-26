import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAdmin } from '@/lib/rbac';
import { claimOrphanTournament } from '@/server/tournaments/claim-owner';
import { toErrorResponse } from '@/server/errors';

const schema = z.object({ tournamentId: z.string().min(1) });

export async function POST(req: NextRequest) {
	const admin = await requireAdmin();
	if (!admin.ok) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
	const parsed = schema.safeParse(await req.json());
	if (!parsed.success) return NextResponse.json({ error: 'Нужен tournamentId' }, { status: 400 });
	try {
		const result = await claimOrphanTournament(parsed.data.tournamentId, admin.user.id);
		return NextResponse.json(result);
	} catch (error) {
		const mapped = toErrorResponse(error);
		return NextResponse.json({ error: mapped.error }, { status: mapped.status });
	}
}
