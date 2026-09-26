import { prisma } from '@/lib/prisma';

export type BalanceMismatch = {
	userId: string;
	displayName: string;
	balance: number;
	transactionSum: number;
	delta: number;
};

export async function reconcileBalances() {
	const [users, sums] = await Promise.all([
		prisma.user.findMany({ select: { id: true, displayName: true, balance: true } }),
		prisma.transaction.groupBy({
			by: ['userId'],
			_sum: { amount: true }
		})
	]);

	const sumByUser = new Map(sums.map((row) => [row.userId, row._sum.amount ?? 0]));
	const mismatches: BalanceMismatch[] = users
		.map((user) => {
			const transactionSum = sumByUser.get(user.id) ?? 0;
			const delta = user.balance - transactionSum;
			return { userId: user.id, displayName: user.displayName, balance: user.balance, transactionSum, delta };
		})
		.filter((row) => row.delta !== 0);

	const globalBalance = users.reduce((acc, user) => acc + user.balance, 0);
	const globalTransactionSum = sums.reduce((acc, row) => acc + (row._sum.amount ?? 0), 0);

	return {
		ok: mismatches.length === 0 && globalBalance === globalTransactionSum,
		mismatches,
		globalBalance,
		globalTransactionSum,
		globalDelta: globalBalance - globalTransactionSum
	};
}
