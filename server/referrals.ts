import { randomInt } from 'crypto';
import { Prisma, TransactionType } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import {
	dueReferralMilestones,
	isReferralCode,
	nextReferralMilestone,
	referralCodeFromBytes,
	type ReferralMilestoneView
} from '@/lib/referrals';
import { parseWalletAmount } from '@/lib/wallet';
import { DomainError } from '@/server/errors';
import { lockUserBalanceRow } from '@/server/db/advisory-lock';

function randomReferralCode() {
	const bytes = new Uint8Array(8);
	for (let i = 0; i < bytes.length; i += 1) bytes[i] = randomInt(0, 256);
	return referralCodeFromBytes(bytes);
}

export async function ensureReferralCode(userId: string) {
	const existing = await prisma.user.findUnique({ where: { id: userId }, select: { referralCode: true } });
	if (existing?.referralCode) return existing.referralCode;
	for (let attempt = 0; attempt < 5; attempt += 1) {
		try {
			const updated = await prisma.user.update({
				where: { id: userId },
				data: { referralCode: randomReferralCode() },
				select: { referralCode: true }
			});
			if (updated.referralCode) return updated.referralCode;
		} catch (error) {
			if (!(error instanceof Prisma.PrismaClientKnownRequestError) || error.code !== 'P2002') throw error;
			const again = await prisma.user.findUnique({ where: { id: userId }, select: { referralCode: true } });
			if (again?.referralCode) return again.referralCode;
		}
	}
	throw new DomainError('Не удалось выдать ссылку', 500);
}

async function payMilestone(userId: string, milestone: ReferralMilestoneView) {
	const amount = parseWalletAmount(milestone.amountKopecks);
	if (amount == null || amount <= 0) return;
	try {
		await prisma.$transaction(async (db) => {
			await lockUserBalanceRow(db, userId);
			const existing = await db.referralPayout.findUnique({
				where: { userId_milestoneId: { userId, milestoneId: milestone.id } },
				select: { id: true }
			});
			if (existing) return;
			const updated = await db.user.update({
				where: { id: userId },
				data: { balance: { increment: amount }, totalEarned: { increment: amount } },
				select: { balance: true }
			});
			const tx = await db.transaction.create({
				data: {
					userId,
					amount,
					balance: updated.balance,
					description: milestone.label.slice(0, 200),
					type: TransactionType.BONUS,
					metadata: { referralMilestoneId: milestone.id, threshold: milestone.threshold }
				}
			});
			await db.referralPayout.create({
				data: { userId, milestoneId: milestone.id, transactionId: tx.id }
			});
			await db.auditLog.create({
				data: {
					actorId: userId,
					action: 'REFERRAL_PAYOUT',
					entity: 'ReferralMilestone',
					entityId: milestone.id,
					payload: { amount, threshold: milestone.threshold }
				}
			});
		});
	} catch (error) {
		if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') return;
		throw error;
	}
}

export async function grantReferralMilestones(userId: string) {
	const count = await prisma.user.count({ where: { referredById: userId } });
	const milestones = await prisma.referralMilestone.findMany({
		where: { isActive: true, threshold: { lte: count } },
		orderBy: { threshold: 'asc' }
	});
	if (!milestones.length) return;
	const paid = await prisma.referralPayout.findMany({
		where: { userId, milestoneId: { in: milestones.map((row) => row.id) } },
		select: { milestoneId: true }
	});
	const due = dueReferralMilestones(count, milestones, new Set(paid.map((row) => row.milestoneId)));
	for (const milestone of due) await payMilestone(userId, milestone);
}

export async function attachReferral(newUserId: string, raw: string | undefined) {
	const code = raw?.trim().toLowerCase() ?? '';
	if (!isReferralCode(code)) return false;
	const inviter = await prisma.user.findUnique({ where: { referralCode: code }, select: { id: true } });
	if (!inviter || inviter.id === newUserId) return false;
	await prisma.user.update({ where: { id: newUserId }, data: { referredById: inviter.id } });
	await prisma.auditLog.create({
		data: {
			actorId: newUserId,
			action: 'REFERRAL_ATTACHED',
			entity: 'User',
			entityId: inviter.id,
			payload: { code }
		}
	});
	await grantReferralMilestones(inviter.id);
	return true;
}

export async function referralDesk(userId: string) {
	const code = await ensureReferralCode(userId);
	const [count, milestones] = await Promise.all([
		prisma.user.count({ where: { referredById: userId } }),
		prisma.referralMilestone.findMany({ where: { isActive: true }, orderBy: { threshold: 'asc' } })
	]);
	const next = nextReferralMilestone(count, milestones);
	return {
		code,
		count,
		next: next
			? {
					threshold: next.threshold,
					label: next.label,
					amountKopecks: next.amountKopecks,
					remaining: next.threshold - count
				}
			: null
	};
}

export async function catchUpReferralMilestone(milestoneId: string) {
	const milestone = await prisma.referralMilestone.findUnique({ where: { id: milestoneId } });
	if (!milestone?.isActive) return;
	const rows = await prisma.user.groupBy({
		by: ['referredById'],
		where: { referredById: { not: null } },
		_count: { _all: true }
	});
	for (const row of rows) {
		if (!row.referredById || row._count._all < milestone.threshold) continue;
		await grantReferralMilestones(row.referredById);
	}
}
