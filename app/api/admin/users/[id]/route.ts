import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { requireAdmin } from '@/lib/rbac';

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
	const admin = await requireAdmin();
	if (!admin.ok) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
	const { id } = await params;
	const user = await prisma.user.findUnique({
		where: { id },
		select: {
			id: true,
			displayName: true,
			steamId: true,
			role: true,
			balance: true,
			totpEnabledAt: true,
			createdAt: true,
			lastLoginAt: true,
			transactions: { orderBy: { createdAt: 'desc' }, take: 10 },
			teamsCreated: { where: { deletedAt: null }, select: { id: true, name: true } },
			memberships: {
				where: { team: { deletedAt: null } },
				select: { confirmed: true, team: { select: { id: true, name: true } } }
			}
		}
	});
	if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 });
	const cups = await prisma.tournament.findMany({
		where: { createdById: id },
		orderBy: { createdAt: 'desc' },
		take: 12,
		select: { id: true, title: true, status: true, prizeStatus: true, prizePool: true }
	});
	return NextResponse.json({
		user: {
			id: user.id,
			displayName: user.displayName,
			steamId: user.steamId,
			role: user.role,
			balance: user.balance,
			totp: Boolean(user.totpEnabledAt),
			createdAt: user.createdAt,
			lastLoginAt: user.lastLoginAt,
			transactions: user.transactions,
			teams: [
				...user.teamsCreated.map((team) => ({ id: team.id, name: team.name, role: 'owner' })),
				...user.memberships.map((row) => ({ id: row.team.id, name: row.team.name, role: row.confirmed ? 'member' : 'pending' }))
			],
			cups
		}
	});
}

const patchSchema = z.object({ totpReset: z.literal(true) });

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
	const admin = await requireAdmin();
	if (!admin.ok) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
	const { id } = await params;
	const parsed = patchSchema.safeParse(await req.json());
	if (!parsed.success) return NextResponse.json({ error: 'Только сброс ключа' }, { status: 400 });
	const user = await prisma.user.update({
		where: { id },
		data: { totpSecret: null, totpEnabledAt: null },
		select: { id: true, displayName: true, totpEnabledAt: true }
	});
	await prisma.auditLog.create({
		data: {
			actorId: admin.user.id,
			action: 'TOTP_RESET',
			entity: 'User',
			entityId: user.id,
			payload: {}
		}
	});
	return NextResponse.json({ user, totp: false });
}
