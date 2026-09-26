import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAdmin } from '@/lib/rbac';
import { z } from 'zod';

export async function GET() {
	const admin = await requireAdmin();
	if (!admin.ok) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
	const teams = await prisma.team.findMany({
		orderBy: { createdAt: 'desc' },
		take: 80,
		select: {
			id: true,
			name: true,
			createdById: true,
			deletedAt: true,
			createdBy: { select: { displayName: true } },
			members: { select: { confirmed: true, isSubstitute: true, user: { select: { steamId: true, displayName: true } } } }
		}
	});
	return NextResponse.json({
		teams: teams.map((team) => ({
			id: team.id,
			name: team.name,
			createdById: team.createdById,
			owner: team.createdBy.displayName,
			deletedAt: team.deletedAt,
			confirmed: team.members.filter((member) => member.confirmed && !member.isSubstitute).length,
			steam: team.members.filter((member) => member.confirmed && !member.isSubstitute && member.user.steamId).length,
			members: team.members
				.filter((member) => !member.isSubstitute)
				.map((member) => ({
					name: member.user.displayName,
					steam: Boolean(member.user.steamId),
					confirmed: member.confirmed
				}))
		}))
	});
}

const patchSchema = z.object({
	id: z.string().min(1),
	name: z.string().min(2).max(64).optional(),
	restore: z.boolean().optional()
});

export async function PATCH(req: NextRequest) {
	const admin = await requireAdmin();
	if (!admin.ok) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
	const parsed = patchSchema.safeParse(await req.json());
	if (!parsed.success) return NextResponse.json({ error: 'Validation failed' }, { status: 400 });
	const team = await prisma.team.update({
		where: { id: parsed.data.id },
		data: {
			...(parsed.data.name ? { name: parsed.data.name } : {}),
			...(parsed.data.restore ? { deletedAt: null } : {})
		}
	});
	return NextResponse.json({ team });
}

export async function DELETE(req: NextRequest) {
	const admin = await requireAdmin();
	if (!admin.ok) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
	const id = new URL(req.url).searchParams.get('id');
	if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 });
	const team = await prisma.team.update({
		where: { id },
		data: { deletedAt: new Date() }
	});
	await prisma.auditLog.create({
		data: {
			actorId: admin.user.id,
			action: 'TEAM_SOFT_DELETED',
			entity: 'Team',
			entityId: id,
			payload: { name: team.name }
		}
	});
	return NextResponse.json({ team });
}
