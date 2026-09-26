import { NextRequest, NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { requireAdmin } from '@/lib/rbac';
import { referralMilestoneSchema } from '@/lib/validators/referral-milestone';
import { parseWalletAmount } from '@/lib/wallet';
import { catchUpReferralMilestone } from '@/server/referrals';

export const dynamic = 'force-dynamic';

function amountError(amount: number) {
	return parseWalletAmount(amount) == null || amount <= 0;
}

export async function GET() {
	const admin = await requireAdmin();
	if (!admin.ok) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
	const [milestones, people] = await Promise.all([
		prisma.referralMilestone.findMany({
			orderBy: { threshold: 'asc' },
			include: { _count: { select: { payouts: true } } }
		}),
		prisma.user.findMany({
			orderBy: { displayName: 'asc' },
			take: 300,
			select: {
				id: true,
				displayName: true,
				avatarUrl: true,
				steamId: true,
				referralCode: true,
				referredBy: { select: { id: true, displayName: true } },
				referrals: {
					orderBy: { createdAt: 'desc' },
					select: { id: true, displayName: true, createdAt: true, avatarUrl: true }
				},
				referralPayouts: {
					orderBy: { createdAt: 'desc' },
					select: { milestone: { select: { label: true } } }
				}
			}
		})
	]);
	return NextResponse.json({
		milestones: milestones.map((row) => ({
			id: row.id,
			threshold: row.threshold,
			amountKopecks: row.amountKopecks,
			label: row.label,
			isActive: row.isActive,
			paidCount: row._count.payouts
		})),
		people: people.map((user) => ({
			id: user.id,
			displayName: user.displayName,
			avatarUrl: user.avatarUrl,
			steamId: user.steamId,
			referralCode: user.referralCode,
			invitedBy: user.referredBy ? { id: user.referredBy.id, displayName: user.referredBy.displayName } : null,
			accepted: user.referrals.map((guest) => ({
				id: guest.id,
				displayName: guest.displayName,
				avatarUrl: guest.avatarUrl,
				createdAt: guest.createdAt.toISOString()
			})),
			paidLabels: user.referralPayouts.map((row) => row.milestone.label)
		}))
	});
}

export async function POST(req: NextRequest) {
	const admin = await requireAdmin();
	if (!admin.ok) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
	const parsed = referralMilestoneSchema.safeParse(await req.json().catch(() => null));
	if (!parsed.success || amountError(parsed.data?.amount ?? 0)) {
		return NextResponse.json({ error: 'Проверьте порог и сумму' }, { status: 400 });
	}
	try {
		const item = await prisma.referralMilestone.create({
			data: {
				threshold: parsed.data.threshold,
				amountKopecks: parsed.data.amount,
				label: parsed.data.label
			}
		});
		await prisma.auditLog.create({
			data: {
				actorId: admin.user.id,
				action: 'REFERRAL_MILESTONE_CREATED',
				entity: 'ReferralMilestone',
				entityId: item.id,
				payload: { threshold: item.threshold, amountKopecks: item.amountKopecks }
			}
		});
		await catchUpReferralMilestone(item.id);
		return NextResponse.json(item, { status: 201 });
	} catch (error) {
		if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
			return NextResponse.json({ error: 'Такой порог уже есть' }, { status: 409 });
		}
		throw error;
	}
}

export async function PUT(req: NextRequest) {
	const admin = await requireAdmin();
	if (!admin.ok) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
	const body = await req.json().catch(() => null);
	const id = typeof body?.id === 'string' ? body.id : '';
	if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 });
	const existing = await prisma.referralMilestone.findUnique({ where: { id } });
	if (!existing) return NextResponse.json({ error: 'Ступень не найдена' }, { status: 404 });
	const parsed = referralMilestoneSchema.partial().safeParse(body);
	if (!parsed.success) return NextResponse.json({ error: 'Проверьте порог и сумму' }, { status: 400 });
	if (parsed.data.amount != null && amountError(parsed.data.amount)) {
		return NextResponse.json({ error: 'Сумма только на плюс' }, { status: 400 });
	}
	try {
		const item = await prisma.referralMilestone.update({
			where: { id },
			data: {
				...(parsed.data.threshold != null ? { threshold: parsed.data.threshold } : {}),
				...(parsed.data.amount != null ? { amountKopecks: parsed.data.amount } : {}),
				...(parsed.data.label ? { label: parsed.data.label } : {}),
				...(typeof body.isActive === 'boolean' ? { isActive: body.isActive } : {})
			}
		});
		await prisma.auditLog.create({
			data: {
				actorId: admin.user.id,
				action: 'REFERRAL_MILESTONE_UPDATED',
				entity: 'ReferralMilestone',
				entityId: item.id,
				payload: { threshold: item.threshold, amountKopecks: item.amountKopecks, isActive: item.isActive }
			}
		});
		if (item.isActive) await catchUpReferralMilestone(item.id);
		return NextResponse.json(item);
	} catch (error) {
		if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
			return NextResponse.json({ error: 'Такой порог уже есть' }, { status: 409 });
		}
		throw error;
	}
}
