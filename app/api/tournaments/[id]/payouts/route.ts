import { NextRequest, NextResponse } from 'next/server';
import { getCurrentSteamUser } from '@/server/auth/session';
import { prisma } from '@/lib/prisma';
import { payTournamentPrizes } from '@/server/prizes/payout';
import { reservePrizePool } from '@/server/prizes/escrow';
import { isTournamentStaff } from '@/server/tournaments/staff';
import { buildPayoutPreview, canActAsEscrowOwner, pickFinalMatch } from '@/lib/prize-places';
import { toErrorResponse, DomainError } from '@/server/errors';
import { payoutTotpGate } from '@/lib/payout-totp';
import { assertSameOriginMutation, readIdempotencyKey } from '@/server/http/mutation-guards';
import { assertRateLimit } from '@/server/rate-limit';
import { getCachedJson, setCachedJson } from '@/server/cache/redis';

async function loadPayoutPreview(tournamentId: string) {
	const tournament = await prisma.tournament.findUnique({
		where: { id: tournamentId },
		select: {
			status: true,
			prizeStatus: true,
			prizePool: true,
			prizeCurrency: true,
			createdById: true,
			prizeAllocations: { select: { place: true, amount: true, status: true, teamId: true } },
			matches: {
				select: {
					bracket: true,
					winnerTeamId: true,
					teamAId: true,
					teamBId: true,
					nextMatchId: true,
					teamA: { select: { id: true, name: true } },
					teamB: { select: { id: true, name: true } }
				}
			}
		}
	});
	if (!tournament) return null;
	const teamNames: Record<string, string> = {};
	for (const match of tournament.matches) {
		if (match.teamA) teamNames[match.teamA.id] = match.teamA.name;
		if (match.teamB) teamNames[match.teamB.id] = match.teamB.name;
	}
	const organizer = tournament.createdById
		? await prisma.user.findUnique({ where: { id: tournament.createdById }, select: { balance: true } })
		: null;
	return {
		createdById: tournament.createdById,
		preview: buildPayoutPreview({
			tournamentStatus: tournament.status,
			prizeStatus: tournament.prizeStatus,
			prizePool: tournament.prizePool,
			organizerBalance: organizer?.balance ?? 0,
			prizeCurrency: tournament.prizeCurrency,
			allocations: tournament.prizeAllocations,
			finalMatch: pickFinalMatch(tournament.matches),
			teamNames
		})
	};
}

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
	const { id } = await params;
	const user = await getCurrentSteamUser();
	if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
	if (!(await isTournamentStaff(user.id, user.role, id))) {
		return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
	}
	const loaded = await loadPayoutPreview(id);
	if (!loaded) return NextResponse.json({ error: 'Турнир не найден' }, { status: 404 });
	return NextResponse.json(loaded.preview);
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
	const { id } = await params;
	try {
		assertSameOriginMutation(req);
		const user = await getCurrentSteamUser();
		if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
		await assertRateLimit(`tournament-payout:${user.id}`, 20, 600);
		if (!(await isTournamentStaff(user.id, user.role, id))) {
			return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
		}
		const body = (await req.json().catch(() => ({}))) as { reserve?: boolean; confirm?: boolean; totp?: string };
		const idemKey = readIdempotencyKey(req);
		const action = body.reserve ? 'reserve' : body.confirm ? 'confirm' : 'noop';
		const cacheKey =
			idemKey && action !== 'noop' ? `tournament-payout-idem:${user.id}:${id}:${action}:${idemKey}` : null;
		if (cacheKey) {
			const cached = await getCachedJson<unknown>(cacheKey);
			if (cached) return NextResponse.json(cached);
		}
		const tournament = await prisma.tournament.findUnique({
			where: { id },
			select: { createdById: true, prizePool: true }
		});
		if (!tournament?.createdById) return NextResponse.json({ error: 'Турнир не найден' }, { status: 404 });
		const staffKey = await prisma.user.findUnique({
			where: { id: user.id },
			select: { totpSecret: true, totpEnabledAt: true }
		});
		const totpEnabled = Boolean(staffKey?.totpEnabledAt && staffKey.totpSecret);
		const { verifyTotp } = await import('@/lib/totp');
		const codeValid = totpEnabled && staffKey?.totpSecret ? verifyTotp(staffKey.totpSecret, body.totp ?? '') : false;
		if (body.reserve) {
			if (!canActAsEscrowOwner({ actorId: user.id, ownerId: tournament.createdById, actorRole: user.role })) {
				return NextResponse.json({ error: 'Резерв списывает кошелёк владельца кубка' }, { status: 403 });
			}
			const gate = payoutTotpGate({ prizePool: tournament.prizePool, totpEnabled, codeValid, action: 'reserve' });
			if (!gate.ok) return NextResponse.json({ error: gate.error }, { status: 400 });
			const escrow = await reservePrizePool(id, tournament.createdById);
			if (cacheKey) await setCachedJson(cacheKey, escrow, 60 * 60 * 24);
			return NextResponse.json(escrow);
		}
		if (body.confirm !== true) {
			return NextResponse.json({ error: 'Подтвердите выплату на карточке' }, { status: 400 });
		}
		const gate = payoutTotpGate({ prizePool: tournament.prizePool, totpEnabled, codeValid, action: 'confirm' });
		if (!gate.ok) return NextResponse.json({ error: gate.error }, { status: 400 });
		const result = await payTournamentPrizes(id, user.id);
		if (cacheKey) await setCachedJson(cacheKey, result, 60 * 60 * 24);
		return NextResponse.json(result);
	} catch (error) {
		if (error instanceof DomainError) {
			return NextResponse.json({ error: error.message }, { status: error.status });
		}
		const mapped = toErrorResponse(error);
		return NextResponse.json({ error: mapped.error }, { status: mapped.status });
	}
}
