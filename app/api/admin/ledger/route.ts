import { NextRequest, NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { requireAdmin } from '@/lib/rbac';
import { transactionsToCsv } from '@/lib/admin-ledger';

export async function GET(req: NextRequest) {
	const admin = await requireAdmin();
	if (!admin.ok) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
	const url = new URL(req.url);
	const kind = url.searchParams.get('kind') || 'tx';
	const q = (url.searchParams.get('q') || '').trim();
	const type = (url.searchParams.get('type') || '').trim();
	const user = (url.searchParams.get('user') || '').trim();
	const entity = (url.searchParams.get('entity') || '').trim();
	const from = url.searchParams.get('from');
	const to = url.searchParams.get('to');
	const format = url.searchParams.get('format');
	const createdAt =
		from || to
			? {
					...(from ? { gte: new Date(from) } : {}),
					...(to ? { lte: new Date(`${to}T23:59:59.999Z`) } : {})
				}
			: undefined;

	if (kind === 'audit') {
		const where: Prisma.AuditLogWhereInput = {
			...(entity ? { entity } : {}),
			...(q ? { OR: [{ action: { contains: q, mode: 'insensitive' } }, { entityId: { contains: q } }] } : {}),
			...(createdAt ? { createdAt } : {})
		};
		const items = await prisma.auditLog.findMany({ where, orderBy: { createdAt: 'desc' }, take: 200 });
		return NextResponse.json({ items });
	}

	const where: Prisma.TransactionWhereInput = {
		...(type ? { type: type as Prisma.TransactionWhereInput['type'] } : {}),
		...(createdAt ? { createdAt } : {}),
		...(user
			? { user: { displayName: { contains: user, mode: Prisma.QueryMode.insensitive } } }
			: {}),
		...(q
			? {
					OR: [
						{ description: { contains: q, mode: Prisma.QueryMode.insensitive } },
						{ user: { displayName: { contains: q, mode: Prisma.QueryMode.insensitive } } }
					]
				}
			: {})
	};
	const items = await prisma.transaction.findMany({
		where,
		orderBy: { createdAt: 'desc' },
		take: 200,
		select: {
			id: true,
			userId: true,
			type: true,
			amount: true,
			balance: true,
			description: true,
			createdAt: true,
			user: { select: { displayName: true } }
		}
	});
	if (format === 'csv') {
		const csv = transactionsToCsv(
			items.map((row) => ({
				createdAt: row.createdAt.toISOString(),
				who: row.user.displayName,
				type: row.type,
				description: row.description,
				amount: row.amount
			}))
		);
		return new NextResponse(csv, {
			headers: {
				'Content-Type': 'text/csv; charset=utf-8',
				'Content-Disposition': 'attachment; filename="ledger.csv"'
			}
		});
	}
	return NextResponse.json({ items });
}
