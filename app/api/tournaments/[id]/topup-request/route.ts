import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCurrentSteamUser } from '@/server/auth/session';
import { isTournamentStaff } from '@/server/tournaments/staff';
import { STAND_ADMIN_ID } from '@/lib/stand-admin';
import { describeEscrowWallet, formatPrizeAmount } from '@/lib/prize-places';

export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
	const { id } = await params;
	const user = await getCurrentSteamUser();
	if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
	if (!(await isTournamentStaff(user.id, user.role, id))) {
		return NextResponse.json({ error: 'Только организатор кубка' }, { status: 403 });
	}
	const tournament = await prisma.tournament.findUnique({
		where: { id },
		select: { id: true, title: true, prizePool: true, prizeStatus: true, createdById: true }
	});
	if (!tournament) return NextResponse.json({ error: 'Турнир не найден' }, { status: 404 });
	const owner = tournament.createdById
		? await prisma.user.findUnique({ where: { id: tournament.createdById }, select: { id: true, displayName: true, balance: true } })
		: null;
	if (!owner) return NextResponse.json({ error: 'У кубка нет орга' }, { status: 409 });
	const wallet = describeEscrowWallet({ prizePool: tournament.prizePool, balance: owner.balance });
	if (wallet.shortfall <= 0) {
		return NextResponse.json({ error: 'На кошельке уже хватает — резервируйте фонд на карточке' }, { status: 409 });
	}
	await prisma.notification.create({
		data: {
			userId: STAND_ADMIN_ID,
			type: 'ADMIN_TOPUP_REQUEST',
			title: `Пополнение под «${tournament.title}»`,
			body: `${user.displayName} просит положить ${wallet.shortfallLabel} на кошелёк ${owner.displayName}. Сайт деньги не печатает.`,
			linkUrl: `/admin/balance?userId=${owner.id}`,
			metadata: {
				tournamentId: tournament.id,
				fromUserId: user.id,
				ownerId: owner.id,
				amount: wallet.shortfall
			}
		}
	});
	await prisma.auditLog.create({
		data: {
			actorId: user.id,
			action: 'ADMIN_TOPUP_REQUEST',
			entity: 'Tournament',
			entityId: tournament.id,
			payload: { shortfall: wallet.shortfall, ownerId: owner.id }
		}
	});
	return NextResponse.json({ ok: true, shortfallLabel: wallet.shortfallLabel, amountLabel: formatPrizeAmount(wallet.shortfall) });
}
