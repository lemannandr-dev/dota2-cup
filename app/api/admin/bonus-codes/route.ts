import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAdmin } from '@/lib/rbac';
import { bonusCodeSchema } from '@/lib/validators/bonus-code';

export async function GET() {
	const admin = await requireAdmin();
	if (!admin.ok) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
	const list = await prisma.bonusCode.findMany({ orderBy: { createdAt: 'desc' } });
	return NextResponse.json({ bonusCodes: list });
}

export async function POST(req: NextRequest) {
	const admin = await requireAdmin();
	if (!admin.ok) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
	const parsed = bonusCodeSchema.safeParse(await req.json().catch(() => null));
	if (!parsed.success) return NextResponse.json({ error: 'Проверьте код и сумму' }, { status: 400 });
	if (parsed.data.amount <= 0) return NextResponse.json({ error: 'Промо только на плюс, не списание' }, { status: 400 });
	const item = await prisma.bonusCode.create({
		data: {
			code: parsed.data.code.trim().toUpperCase(),
			amount: parsed.data.amount,
			description: parsed.data.description.trim().slice(0, 200),
			maxUses: parsed.data.maxUses ?? null,
			validUntil: parsed.data.validUntil ? new Date(parsed.data.validUntil) : null,
			minLevel: parsed.data.minLevel ?? null,
			roles: parsed.data.roles ?? [],
			createdById: admin.user.id
		}
	});
	return NextResponse.json(item, { status: 201 });
}

export async function PUT(req: NextRequest) {
	const admin = await requireAdmin();
	if (!admin.ok) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
	const body = await req.json().catch(() => null);
	const id = typeof body?.id === 'string' ? body.id : '';
	if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 });
	const parsed = bonusCodeSchema.partial().safeParse(body);
	if (!parsed.success) return NextResponse.json({ error: 'Проверьте поля кода' }, { status: 400 });
	if (parsed.data.amount != null && parsed.data.amount <= 0) {
		return NextResponse.json({ error: 'Промо только на плюс, не списание' }, { status: 400 });
	}
	const existing = await prisma.bonusCode.findUnique({ where: { id }, select: { id: true, amount: true, usedCount: true } });
	if (!existing) return NextResponse.json({ error: 'Код не найден' }, { status: 404 });
	if (parsed.data.amount != null && parsed.data.amount !== existing.amount && existing.usedCount > 0) {
		return NextResponse.json({ error: 'Сумму нельзя менять после активаций' }, { status: 400 });
	}
	const item = await prisma.bonusCode.update({
		where: { id },
		data: {
			...(parsed.data.code ? { code: parsed.data.code.trim().toUpperCase() } : {}),
			...(parsed.data.amount != null ? { amount: parsed.data.amount } : {}),
			...(parsed.data.description ? { description: parsed.data.description.trim().slice(0, 200) } : {}),
			...(parsed.data.maxUses !== undefined ? { maxUses: parsed.data.maxUses } : {}),
			...(parsed.data.validUntil !== undefined
				? { validUntil: parsed.data.validUntil ? new Date(parsed.data.validUntil) : null }
				: {}),
			...(parsed.data.minLevel !== undefined ? { minLevel: parsed.data.minLevel } : {}),
			...(parsed.data.roles ? { roles: parsed.data.roles } : {}),
			...(typeof body.isActive === 'boolean' ? { isActive: body.isActive } : {})
		}
	});
	return NextResponse.json(item);
}

export async function DELETE(req: NextRequest) {
	const admin = await requireAdmin();
	if (!admin.ok) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
	const id = new URL(req.url).searchParams.get('id');
	if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 });
	await prisma.bonusCode.update({ where: { id }, data: { isActive: false } });
	return NextResponse.json({ success: true });
}
