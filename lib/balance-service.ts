import { prisma } from './prisma';
import { Prisma, TransactionType } from '@prisma/client';
import { DomainError } from '@/server/errors';
import { lockUserBalanceRow } from '@/server/db/advisory-lock';
import { parseWalletAmount } from '@/lib/wallet';

export class BalanceService {
	static async adjust(
		userId: string,
		amount: number,
		description: string,
		meta?: Prisma.InputJsonValue,
		type?: TransactionType
	) {
		const parsed = parseWalletAmount(amount);
		if (parsed == null) throw new DomainError('Сумма должна быть целым числом копеек, не ноль и не больше 500 000 ₽', 400);
		const note = description.trim().slice(0, 200) || 'Правка баланса';

		return prisma.$transaction(async (db) => {
			await lockUserBalanceRow(db, userId);
			const updated = await db.user.update({
				where: { id: userId },
				data: {
					balance: { increment: parsed },
					totalEarned: parsed > 0 ? { increment: parsed } : undefined,
					totalSpent: parsed < 0 ? { increment: Math.abs(parsed) } : undefined
				}
			});
			if (updated.balance < 0 && type !== TransactionType.PENALTY) {
				throw new DomainError('Недостаточно средств', 400);
			}
			const resolvedType = type ?? (parsed >= 0 ? TransactionType.DEPOSIT : TransactionType.WITHDRAW);
			return db.transaction.create({
				data: {
					userId,
					amount: parsed,
					balance: updated.balance,
					description: note,
					metadata: meta,
					type: resolvedType
				}
			});
		});
	}
}
