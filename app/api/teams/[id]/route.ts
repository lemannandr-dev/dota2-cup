import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCurrentSteamUser } from '@/lib/steam-session';
import { z } from 'zod';

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
	const { id } = await params;
	const team = await prisma.team.findUnique({ where: { id }, include: { members: true } });
	if (!team) return NextResponse.json({ error: 'not found' }, { status: 404 });
	return NextResponse.json({ team });
}

const optionalUrl = z
	.string()
	.trim()
	.max(2048)
	.optional()
	.transform((value) => value || undefined)
	.refine((value) => !value || /^https?:\/\//i.test(value), 'URL must start with http:// or https://');

const updateSchema = z.object({
	name: z.string().trim().min(2).max(80),
	tag: z.string().trim().max(12).optional().transform((value) => value || undefined),
	game: z.string().trim().min(2).max(50).default('Dota 2'),
	description: z.string().trim().max(1200).optional().transform((value) => value || undefined),
	logo: optionalUrl,
	bannerUrl: optionalUrl,
	videoUrl: optionalUrl,
	contactUrl: optionalUrl,
	region: z.string().trim().max(50).optional().transform((value) => value || undefined),
	language: z.string().trim().max(30).optional().transform((value) => value || undefined),
	playstyle: z.string().trim().max(80).optional().transform((value) => value || undefined),
	goals: z.string().trim().max(500).optional().transform((value) => value || undefined),
	recruitmentStatus: z.enum(['OPEN', 'INVITE_ONLY', 'CLOSED']).default('OPEN')
});

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
	const user = await getCurrentSteamUser();
	if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

	const { id } = await params;
	const parsed = updateSchema.safeParse(await req.json());
	if (!parsed.success) {
		return NextResponse.json({ error: 'Validation failed', issues: parsed.error.issues }, { status: 400 });
	}

	const team = await prisma.team.findFirst({
		where: {
			id,
			deletedAt: null,
			OR: [
				{ createdById: user.id },
				{ members: { some: { userId: user.id, role: 'captain', confirmed: true } } }
			]
		}
	});

	if (!team) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

	const updated = await prisma.team.update({
		where: { id },
		data: parsed.data
	});

	await prisma.auditLog.create({
		data: { actorId: user.id, action: 'TEAM_UPDATED', entity: 'Team', entityId: id }
	});

	return NextResponse.json({ team: updated }, { status: 200 });
}













