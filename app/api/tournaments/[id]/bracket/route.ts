import { NextRequest, NextResponse } from 'next/server';
import { getCurrentSteamUser } from '@/server/auth/session';
import { generateTournamentBracket } from '@/server/tournaments/generate-bracket';
import { isTournamentStaff } from '@/server/tournaments/staff';
import { toErrorResponse } from '@/server/errors';
import { prisma } from '@/lib/prisma';
import { previewFirstRoundPairs } from '@/lib/bracket-preview';

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
	const { id: tournamentId } = await params;
	const user = await getCurrentSteamUser();
	if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
	if (!(await isTournamentStaff(user.id, user.role, tournamentId))) {
		return NextResponse.json({ error: 'Только организатор или администратор' }, { status: 403 });
	}
	const tournament = await prisma.tournament.findUnique({
		where: { id: tournamentId },
		select: {
			status: true,
			applications: {
				where: { status: 'CHECKED_IN' },
				orderBy: { createdAt: 'asc' },
				select: { teamId: true, seed: true, team: { select: { name: true } } }
			}
		}
	});
	if (!tournament) return NextResponse.json({ error: 'Турнир не найден' }, { status: 404 });
	const pairs = previewFirstRoundPairs(
		tournament.applications.map((app, index) => ({
			teamId: app.teamId,
			name: app.team.name,
			seed: app.seed ?? index + 1
		}))
	);
	return NextResponse.json({ status: tournament.status, checkedIn: tournament.applications.length, pairs });
}

export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
	const { id: tournamentId } = await params;
	const user = await getCurrentSteamUser();
	if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
	if (!(await isTournamentStaff(user.id, user.role, tournamentId))) {
		return NextResponse.json({ error: 'Только организатор или администратор' }, { status: 403 });
	}
	try {
		const result = await generateTournamentBracket(tournamentId, user.id);
		return NextResponse.json({ success: true, ...result });
	} catch (error) {
		const mapped = toErrorResponse(error);
		return NextResponse.json({ error: mapped.error }, { status: mapped.status });
	}
}
