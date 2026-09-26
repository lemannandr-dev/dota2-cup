import { redirect } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import { getCurrentSteamUser } from '@/server/auth/session';
import { isStandAdmin } from '@/lib/stand-admin';
import { BalanceDesk } from '@/components/balance/BalanceDesk';
import { TournamentStatus } from '@prisma/client';

export const dynamic = 'force-dynamic';

const LIVE_CUP = {
	in: [TournamentStatus.REGISTRATION, TournamentStatus.CHECK_IN, TournamentStatus.LIVE]
};

export default async function BalancePage() {
	const user = await getCurrentSteamUser();
	if (!user) redirect('/');

	const [fresh, tx, cups, pendingCups, promos] = await Promise.all([
		prisma.user.findUnique({
			where: { id: user.id },
			select: { balance: true, totalEarned: true, totalSpent: true, role: true }
		}),
		prisma.transaction.findMany({
			where: { userId: user.id },
			orderBy: { createdAt: 'desc' },
			take: 80,
			select: { id: true, type: true, amount: true, balance: true, description: true, createdAt: true }
		}),
		prisma.tournament.findMany({
			where: {
				createdById: user.id,
				prizeStatus: 'CONFIRMED',
				status: LIVE_CUP
			},
			orderBy: { startAt: 'asc' },
			select: { id: true, title: true, prizePool: true, status: true }
		}),
		prisma.tournament.findMany({
			where: {
				createdById: user.id,
				prizeStatus: 'UNCONFIRMED',
				status: { in: ['DRAFT', 'REGISTRATION', 'CHECK_IN'] }
			},
			orderBy: { startAt: 'asc' },
			take: 8,
			select: { id: true, title: true, prizePool: true, status: true }
		}),
		prisma.bonusRedemption.findMany({
			where: { userId: user.id },
			orderBy: { createdAt: 'desc' },
			take: 12,
			select: {
				id: true,
				createdAt: true,
				bonusCode: { select: { code: true, amount: true, description: true } }
			}
		})
	]);

	const balance = fresh?.balance ?? 0;
	return (
		<BalanceDesk
			balance={balance}
			earned={fresh?.totalEarned ?? 0}
			spent={fresh?.totalSpent ?? 0}
			escrowHeld={cups.reduce((sum, cup) => sum + cup.prizePool, 0)}
			cups={cups}
			pendingCups={pendingCups}
			promos={promos.map((row) => ({
				id: row.id,
				code: row.bonusCode.code,
				amount: row.bonusCode.amount,
				note: row.bonusCode.description,
				createdAt: row.createdAt.toISOString()
			}))}
			ledger={tx.map((row) => ({
				id: row.id,
				type: row.type,
				amount: row.amount,
				balance: row.balance,
				description: row.description,
				createdAt: row.createdAt.toISOString()
			}))}
			canHost={fresh?.role === 'ORGANIZER' || fresh?.role === 'ADMIN' || isStandAdmin(user)}
			profileHref={`/profile/${user.id}`}
		/>
	);
}
