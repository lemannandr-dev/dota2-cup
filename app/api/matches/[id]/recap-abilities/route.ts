import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCurrentSteamUser } from '@/server/auth/session';
import { abilityIdsFromUses } from '@/lib/match-recap';
import { fetchOpenDotaMatch } from '@/server/matches/verify-opendota';
import { steamId64ToAccountId } from '@/lib/dota-account';
import { assertRateLimit } from '@/server/rate-limit';

/**
 * Optional recap polish: top ability names from the first linked OpenDota match.
 * Public to signed-in users who can see the pair; fails soft (empty) when OD is down.
 */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
	const { id: matchId } = await params;
	const user = await getCurrentSteamUser();
	if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

	try {
		await assertRateLimit(`recap-abilities:${user.id}`, 40, 600);
	} catch {
		return NextResponse.json({ abilityIds: [] });
	}

	const match = await prisma.match.findUnique({
		where: { id: matchId },
		select: {
			status: true,
			dotaMatchIds: true,
			teamA: { select: { members: { select: { user: { select: { steamId: true, id: true } } } } } },
			teamB: { select: { members: { select: { user: { select: { steamId: true, id: true } } } } } }
		}
	});
	if (!match || !['COMPLETED', 'TECHNICAL'].includes(match.status)) {
		return NextResponse.json({ abilityIds: [] });
	}
	const dotaId = match.dotaMatchIds?.[0];
	if (!dotaId) return NextResponse.json({ abilityIds: [] });

	const od = await fetchOpenDotaMatch(dotaId);
	if (!od?.players?.length) return NextResponse.json({ abilityIds: [] });

	const memberSteam = new Map<string, string | null | undefined>();
	for (const side of [match.teamA, match.teamB]) {
		for (const member of side?.members ?? []) {
			memberSteam.set(member.user.id, member.user.steamId);
		}
	}
	const viewerAccount = steamId64ToAccountId(memberSteam.get(user.id) ?? user.steamId ?? null);
	const player =
		(viewerAccount != null ? od.players.find((row) => row.account_id === viewerAccount) : null) ??
		od.players.find((row) => row.ability_uses && Object.keys(row.ability_uses).length > 0) ??
		null;

	const abilityIds = abilityIdsFromUses(player?.ability_uses, 4) ?? [];
	return NextResponse.json({ abilityIds });
}
