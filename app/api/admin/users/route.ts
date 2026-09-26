import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAdmin } from '@/lib/rbac';
import { canAssignStandRole, canDeleteStandUser } from '@/lib/stand-admin';
import { Prisma, Role } from '@prisma/client';
import { z } from 'zod';

const publicUser = {
	id: true,
	userId: true,
	displayName: true,
	username: true,
	email: true,
	role: true,
	steamId: true,
	avatarUrl: true,
	balance: true,
	totpEnabledAt: true,
	createdAt: true,
	lastLoginAt: true
} as const;

export async function GET(req: NextRequest) {
	const admin = await requireAdmin();
	if (!admin.ok) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
	const { searchParams } = new URL(req.url);
	const q = (searchParams.get('q') || '').trim();
	const where: Prisma.UserWhereInput = q
		? {
				OR: [
					{ username: { contains: q, mode: Prisma.QueryMode.insensitive } },
					{ email: { contains: q, mode: Prisma.QueryMode.insensitive } },
					{ userId: { contains: q, mode: Prisma.QueryMode.insensitive } },
					{ displayName: { contains: q, mode: Prisma.QueryMode.insensitive } },
					{ steamId: { contains: q } },
					{ id: { contains: q } }
				]
			}
		: {};
	const users = await prisma.user.findMany({ where, orderBy: { createdAt: 'desc' }, take: 100, select: publicUser });
	return NextResponse.json({ users });
}

const patchSchema = z.object({
	userId: z.string().min(1),
	role: z.nativeEnum(Role).optional(),
	displayName: z.string().min(1).max(64).optional()
});

export async function PATCH(req: NextRequest) {
	const admin = await requireAdmin();
	if (!admin.ok) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
	const parsed = patchSchema.safeParse(await req.json());
	if (!parsed.success) return NextResponse.json({ error: 'Validation failed' }, { status: 400 });
	if (parsed.data.role && !canAssignStandRole({ actorId: admin.user.id, targetId: parsed.data.userId, nextRole: parsed.data.role })) {
		return NextResponse.json({ error: 'ADMIN только у владельца стенда' }, { status: 403 });
	}
	const current = await prisma.user.findUnique({
		where: { id: parsed.data.userId },
		select: { id: true, role: true }
	});
	if (!current) return NextResponse.json({ error: 'User not found' }, { status: 404 });
	const user = await prisma.user.update({
		where: { id: current.id },
		data: {
			...(parsed.data.role ? { role: parsed.data.role } : {}),
			...(parsed.data.displayName ? { displayName: parsed.data.displayName } : {})
		},
		select: publicUser
	});
	if (parsed.data.role && parsed.data.role !== current.role) {
		await prisma.auditLog.create({
			data: {
				actorId: admin.user.id,
				action: 'ROLE_CHANGED',
				entity: 'User',
				entityId: user.id,
				payload: { from: current.role, to: parsed.data.role }
			}
		});
	}
	return NextResponse.json({ user });
}

export async function DELETE(req: NextRequest) {
	const admin = await requireAdmin();
	if (!admin.ok) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
	const id = new URL(req.url).searchParams.get('id');
	if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 });
	if (!canDeleteStandUser({ actorId: admin.user.id, targetId: id })) {
		return NextResponse.json({ error: 'Владельца стенда удалить нельзя' }, { status: 403 });
	}
	const teams = await prisma.team.count({ where: { createdById: id, deletedAt: null } });
	const cups = await prisma.tournament.count({ where: { createdById: id } });
	if (teams > 0 || cups > 0) {
		return NextResponse.json({ error: 'Сначала удалите команды и кубки этого игрока' }, { status: 409 });
	}
	try {
		await prisma.session.deleteMany({ where: { userId: id } });
		await prisma.user.delete({ where: { id } });
	} catch {
		return NextResponse.json({ error: 'Аккаунт связан с матчами или заявками — удалить нельзя' }, { status: 409 });
	}
	await prisma.auditLog.create({
		data: {
			actorId: admin.user.id,
			action: 'USER_DELETED',
			entity: 'User',
			entityId: id,
			payload: {}
		}
	});
	return NextResponse.json({ success: true });
}
