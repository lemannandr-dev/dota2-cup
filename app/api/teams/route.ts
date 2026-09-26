import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCurrentSteamUser } from '@/lib/steam-session';
import type { Prisma } from '@prisma/client';
import { z } from 'zod';

export async function GET(req: NextRequest) {
	const { searchParams } = new URL(req.url);
	const game = searchParams.get('game') || undefined;
	const q = searchParams.get('q') || undefined;
	const where: Prisma.TeamWhereInput = {};
	if (game) where.game = game;
	if (q) where.name = { contains: q, mode: 'insensitive' };
	const teams = await prisma.team.findMany({ where, orderBy: { createdAt: 'desc' }, take: 100 });
	return NextResponse.json({ teams });
}

const optionalUrl = z
	.string()
	.trim()
	.max(2048)
	.optional()
	.transform((value) => value || undefined)
	.refine((value) => !value || /^https?:\/\//i.test(value), 'URL must start with http:// or https://');

const createSchema = z.object({
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

export async function POST(req: NextRequest) {
	const user = await getCurrentSteamUser();
	if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

	const parsed = createSchema.safeParse(await req.json());
	if (!parsed.success) {
		return NextResponse.json({ error: 'Validation failed', issues: parsed.error.issues }, { status: 400 });
	}

	const team = await prisma.team.create({
		data: {
			...parsed.data,
			createdById: user.id,
			members: {
				create: {
					userId: user.id,
					role: 'captain',
					confirmed: true,
					confirmedAt: new Date()
				}
			}
		},
		include: { members: true }
	});

	await prisma.auditLog.create({
		data: { actorId: user.id, action: 'TEAM_CREATED', entity: 'Team', entityId: team.id }
	});

	return NextResponse.json({ team }, { status: 201 });
}













