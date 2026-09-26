import { NextRequest, NextResponse } from 'next/server';
import { TransactionType } from '@prisma/client';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { requireAdmin } from '@/lib/rbac';
import { BalanceService } from '@/lib/balance-service';
import { parseWalletAmount } from '@/lib/wallet';
import { DomainError } from '@/server/errors';
import { assertRateLimit } from '@/server/rate-limit';

const schema = z.object({
	userId: z.string().min(8).max(64),
	amount: z.number(),
	description: z.string().trim().max(200).optional(),
	penalty: z.boolean().optional()
});

export async function POST(req: NextRequest) {
	const admin = await requireAdmin();
	if (!admin.ok) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
	try {
		await assertRateLimit(`admin-balance:${admin.user.id}`, 20, 60);
		const parsed = schema.safeParse(await req.json().catch(() => null));
		if (!parsed.success) return NextResponse.json({ error: 'Некорректные данные' }, { status: 400 });
		if (parseWalletAmount(parsed.data.amount) == null) {
			return NextResponse.json({ error: 'Сумма — целые копейки, не ноль, не больше 500 000 ₽' }, { status: 400 });
		}
		const type = parsed.data.penalty ? TransactionType.PENALTY : undefined;
		const tx = await BalanceService.adjust(
			parsed.data.userId,
			parsed.data.amount,
			parsed.data.description || 'Admin adjust',
			{ adminId: admin.user.id },
			type
		);
		await prisma.auditLog.create({
			data: {
				actorId: admin.user.id,
				action: 'BALANCE_ADJUST',
				entity: 'User',
				entityId: parsed.data.userId,
				payload: {
					amount: parsed.data.amount,
					description: parsed.data.description || 'Admin adjust',
					penalty: Boolean(parsed.data.penalty)
				}
			}
		});
		return NextResponse.json({ success: true, transactionId: tx.id, balance: tx.balance });
	} catch (error: unknown) {
		if (error instanceof DomainError) {
			return NextResponse.json({ error: error.message }, { status: error.status });
		}
		return NextResponse.json({ error: 'Не удалось провести проводку' }, { status: 400 });
	}
}
