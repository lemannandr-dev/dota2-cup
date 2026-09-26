import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getCurrentSteamUser } from '@/server/auth/session';
import { prisma } from '@/lib/prisma';
import {
	assignTournamentReferee,
	isTournamentStaff,
	loadStaffActor,
	removeTournamentReferee,
	searchArenaUsers
} from '@/server/tournaments/staff';
import { canAssignTournamentReferee } from '@/lib/staff-policy';
import { refereeSeat } from '@/lib/referee-ballot';
import { toErrorResponse } from '@/server/errors';

const assignSchema = z
	.object({
		userId: z.string().trim().min(1).optional(),
		steamId: z.string().trim().min(15).max(20).optional(),
		query: z.string().trim().min(2).max(80).optional()
	})
	.refine((row) => Boolean(row.userId || row.steamId || row.query), { message: 'query' });

const removeSchema = z.object({
	userId: z.string().min(1)
});

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
	const { id } = await params;
	const user = await getCurrentSteamUser();
	if (!user) return NextResponse.json({ error: 'Войдите через Steam' }, { status: 401 });
	if (!(await isTournamentStaff(user.id, user.role, id))) {
		return NextResponse.json({ error: 'Только штаб турнира' }, { status: 403 });
	}
	const tournament = await prisma.tournament.findUnique({
		where: { id },
		select: {
			createdById: true,
			staff: {
				select: {
					role: true,
					user: { select: { id: true, displayName: true, steamId: true, avatarUrl: true, rating: true, ratingGames: true } }
				}
			}
		}
	});
	if (!tournament) return NextResponse.json({ error: 'Турнир не найден' }, { status: 404 });
	const gate = await loadStaffActor(user.id, user.role, id);
	const canManage = gate ? canAssignTournamentReferee(gate.actor) : false;
	const query = new URL(req.url).searchParams.get('q')?.trim() ?? '';
	const staffByUser = new Map(tournament.staff.map((row) => [row.user.id, row.role]));
	const candidates = query.length >= 2 ? await searchArenaUsers(query) : [];
	return NextResponse.json({
		canManage,
		candidates: candidates.map((row) => ({
			userId: row.id,
			displayName: row.displayName,
			steamId: row.steamId,
			avatarUrl: row.avatarUrl,
			rating: row.rating,
			ratingGames: row.ratingGames,
			seat: refereeSeat({
				userId: row.id,
				ownerId: tournament.createdById,
				staffRole: staffByUser.get(row.id) ?? null
			})
		})),
		staff: tournament.staff.map((row) => ({
			userId: row.user.id,
			displayName: row.user.displayName,
			steamId: row.user.steamId,
			avatarUrl: row.user.avatarUrl,
			role: row.role,
			isOwner: row.user.id === tournament.createdById
		}))
	});
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
	const { id } = await params;
	const user = await getCurrentSteamUser();
	if (!user) return NextResponse.json({ error: 'Войдите через Steam' }, { status: 401 });
	const parsed = assignSchema.safeParse(await req.json());
	if (!parsed.success) return NextResponse.json({ error: 'Напишите имя на арене или SteamID64' }, { status: 400 });
	try {
		const staff = await assignTournamentReferee(id, user.id, user.role, parsed.data);
		return NextResponse.json({ staff });
	} catch (error) {
		const mapped = toErrorResponse(error);
		return NextResponse.json({ error: mapped.error }, { status: mapped.status });
	}
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
	const { id } = await params;
	const user = await getCurrentSteamUser();
	if (!user) return NextResponse.json({ error: 'Войдите через Steam' }, { status: 401 });
	const parsed = removeSchema.safeParse(await req.json());
	if (!parsed.success) return NextResponse.json({ error: 'Укажите судью' }, { status: 400 });
	try {
		await removeTournamentReferee(id, user.id, user.role, parsed.data.userId);
		return NextResponse.json({ ok: true });
	} catch (error) {
		const mapped = toErrorResponse(error);
		return NextResponse.json({ error: mapped.error }, { status: mapped.status });
	}
}
