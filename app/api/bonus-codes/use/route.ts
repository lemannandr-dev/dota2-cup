import { NextRequest, NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { getCurrentSteamUser } from '@/server/auth/session';
import { DomainError } from '@/server/errors';
import { assertRateLimit } from '@/server/rate-limit';
import { lockUserBalanceRow } from '@/server/db/advisory-lock';
import { bonusCodeRejectReason, parseWalletAmount } from '@/lib/wallet';
import { z } from 'zod';

const schema = z.object({ code: z.string().trim().min(4).max(32) });

export async function POST(req: NextRequest) {
	try {
		const user = await getCurrentSteamUser();
		if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
		await assertRateLimit(`bonus:${user.id}`, 8, 600);

		const parsed = schema.safeParse(await req.json().catch(() => null));
		if (!parsed.success) return NextResponse.json({ error: 'Некорректный код' }, { status: 400 });
		const code = parsed.data.code.toUpperCase().replace(/[^A-Z0-9_-]/g, '');
		if (code.length < 4) return NextResponse.json({ error: 'Некорректный код' }, { status: 400 });

		const res = await prisma.$transaction(async (db) => {
			await lockUserBalanceRow(db, user.id);
			const holder = await db.user.findUnique({
				where: { id: user.id },
				select: { level: true, role: true }
			});
			if (!holder) throw new DomainError('Код не подходит', 400);

			const found = await db.bonusCode.findUnique({ where: { code } });
			if (!found) throw new DomainError('Код не подходит', 400);
			await db.$executeRaw`SELECT id FROM "BonusCode" WHERE id = ${found.id} FOR UPDATE`;
			const bonus = await db.bonusCode.findUnique({ where: { id: found.id } });
			if (!bonus || parseWalletAmount(bonus.amount) == null) throw new DomainError('Код не подходит', 400);

			const reason = bonusCodeRejectReason({
				isActive: bonus.isActive,
				amount: bonus.amount,
				usedCount: bonus.usedCount,
				maxUses: bonus.maxUses,
				validFrom: bonus.validFrom,
				validUntil: bonus.validUntil,
				minLevel: bonus.minLevel,
				roles: bonus.roles,
				userLevel: holder.level,
				userRole: holder.role
			});
			if (reason) throw new DomainError(reason, 400);

			const already = await db.bonusRedemption.findUnique({
				where: { userId_bonusCodeId: { userId: user.id, bonusCodeId: bonus.id } }
			});
			if (already) throw new DomainError('Этот код уже использован', 400);

			const bumped = await db.$executeRaw`
				UPDATE "BonusCode"
				SET "usedCount" = "usedCount" + 1, "updatedAt" = NOW()
				WHERE id = ${bonus.id}
					AND "isActive" = true
					AND amount > 0
					AND ("validFrom" IS NULL OR "validFrom" <= NOW())
					AND ("validUntil" IS NULL OR "validUntil" >= NOW())
					AND ("maxUses" IS NULL OR "usedCount" < "maxUses")
			`;
			if (Number(bumped) !== 1) throw new DomainError('Лимит исчерпан', 400);

			const updated = await db.user.update({
				where: { id: user.id },
				data: { balance: { increment: bonus.amount }, totalEarned: { increment: bonus.amount } }
			});
			await db.bonusRedemption.create({ data: { userId: user.id, bonusCodeId: bonus.id } });
			await db.transaction.create({
				data: {
					userId: user.id,
					amount: bonus.amount,
					balance: updated.balance,
					description: `Промо ${bonus.code}`,
					bonusCodeId: bonus.id,
					type: 'BONUS'
				}
			});
			return { balance: updated.balance, amount: bonus.amount };
		});

		return NextResponse.json({ success: true, balance: res.balance, amount: res.amount });
	} catch (e: unknown) {
		if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
			return NextResponse.json({ error: 'Этот код уже использован' }, { status: 400 });
		}
		if (e instanceof DomainError) {
			return NextResponse.json({ error: e.message }, { status: e.status });
		}
		return NextResponse.json({ error: 'Не удалось активировать код' }, { status: 400 });
	}
}
