import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAdmin } from '@/lib/rbac';
import { STAND_ADMIN_ID } from '@/lib/stand-admin';

export async function GET() {
	const admin = await requireAdmin();
	if (!admin.ok) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
	const items = await prisma.notification.findMany({
		where: { userId: STAND_ADMIN_ID, type: 'ADMIN_TOPUP_REQUEST' },
		orderBy: { createdAt: 'desc' },
		take: 40
	});
	return NextResponse.json({ items });
}
