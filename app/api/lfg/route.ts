import { NextRequest, NextResponse } from 'next/server';
import { getCurrentSteamUser } from '@/server/auth/session';
import { closeLfgPost, listActiveLfg, upsertLfgPost } from '@/server/lfg/posts';
import { toErrorResponse } from '@/server/errors';
import { z } from 'zod';

export async function GET() {
	const posts = await listActiveLfg();
	return NextResponse.json({ posts });
}

const schema = z.object({
	roles: z.array(z.number().int().min(1).max(5)).min(1),
	mmrMin: z.number().int().min(0).max(20000).optional(),
	mmrMax: z.number().int().min(0).max(20000).optional(),
	windowFrom: z.string().datetime().optional(),
	windowTo: z.string().datetime().optional(),
	note: z.string().max(400).optional(),
	hours: z.number().int().min(1).max(48).optional(),
	tournamentId: z.string().min(1).max(64).nullable().optional()
});

export async function POST(req: NextRequest) {
	const user = await getCurrentSteamUser();
	if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
	let body: unknown;
	try {
		body = await req.json();
	} catch {
		return NextResponse.json({ error: 'Некорректная анкета' }, { status: 400 });
	}
	const parsed = schema.safeParse(body);
	if (!parsed.success) return NextResponse.json({ error: 'Некорректная анкета' }, { status: 400 });
	try {
		const hours = parsed.data.hours ?? 6;
		const post = await upsertLfgPost(user.id, {
			roles: parsed.data.roles,
			mmrMin: parsed.data.mmrMin,
			mmrMax: parsed.data.mmrMax,
			windowFrom: parsed.data.windowFrom ? new Date(parsed.data.windowFrom) : null,
			windowTo: parsed.data.windowTo ? new Date(parsed.data.windowTo) : null,
			note: parsed.data.note,
			tournamentId: parsed.data.tournamentId ?? null,
			expiresAt: new Date(Date.now() + hours * 60 * 60 * 1000)
		});
		return NextResponse.json({ post }, { status: 201 });
	} catch (error) {
		const mapped = toErrorResponse(error);
		return NextResponse.json({ error: mapped.error }, { status: mapped.status });
	}
}

export async function DELETE() {
	const user = await getCurrentSteamUser();
	if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
	await closeLfgPost(user.id);
	return NextResponse.json({ ok: true });
}
