import { NextResponse } from 'next/server';
import { getCurrentSteamUser } from '@/lib/steam-session';
import { isSameOriginAppearanceRequest, readAppearanceBody } from '@/server/appearance-request';
import { DomainError, toErrorResponse } from '@/server/errors';
import { assertRateLimit } from '@/server/rate-limit';
import { saveTeamCover } from '@/server/teams/cover';
import { MAX_TEAM_VIDEO_BYTES } from '@/lib/team-cover';

export const dynamic = 'force-dynamic';

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
	const user = await getCurrentSteamUser();
	if (!user || !isSameOriginAppearanceRequest(request)) {
		return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
	}
	try {
		await assertRateLimit(`team-cover:${user.id}`, 12, 600);
		const { id } = await params;
		const body = await readAppearanceBody(request, MAX_TEAM_VIDEO_BYTES + 64 * 1024);
		const form = await new Response(Uint8Array.from(body), {
			headers: { 'Content-Type': request.headers.get('content-type') || '' }
		}).formData();
		const file = form.get('file');
		const slot = form.get('slot');
		if (!(file instanceof File)) throw new DomainError('Файл не передан');
		if (slot !== 'logo' && slot !== 'cover') throw new DomainError('Неизвестное поле');
		const bytes = Buffer.from(await file.arrayBuffer());
		const team = await saveTeamCover({ actorId: user.id, teamId: id, slot, bytes });
		return NextResponse.json({ team });
	} catch (error) {
		const mapped = toErrorResponse(error);
		return NextResponse.json({ error: mapped.error }, { status: mapped.status });
	}
}
