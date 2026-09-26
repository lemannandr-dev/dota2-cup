import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCurrentSteamUser } from '@/lib/steam-session';
import { z } from 'zod';
import { assertTeamsCanChallenge } from '@/server/scrims/open';

const challengeSchema = z.object({
	fromTeamId: z.string().min(1),
	toTeamId: z.string().min(1),
	message: z.string().trim().max(500).optional().transform((value) => value || undefined),
	scheduledAt: z.string().datetime().optional()
});

export async function POST(req: NextRequest) {
	const user = await getCurrentSteamUser();
	if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

	const parsed = challengeSchema.safeParse(await req.json());
	if (!parsed.success) {
		return NextResponse.json({ error: 'Validation failed', issues: parsed.error.issues }, { status: 400 });
	}

	const { fromTeamId, toTeamId, message, scheduledAt } = parsed.data;
	if (fromTeamId === toTeamId) {
		return NextResponse.json({ error: 'Нельзя вызвать свою же команду.' }, { status: 400 });
	}

	const [fromTeam, toTeam] = await Promise.all([
		prisma.team.findFirst({
			where: {
				id: fromTeamId,
				deletedAt: null,
				OR: [
					{ createdById: user.id },
					{ members: { some: { userId: user.id, role: 'captain', confirmed: true } } }
				]
			},
			select: { id: true, name: true, tag: true, createdById: true }
		}),
		prisma.team.findFirst({
			where: { id: toTeamId, deletedAt: null },
			select: { id: true, name: true, tag: true, createdById: true }
		})
	]);

	if (!fromTeam) return NextResponse.json({ error: 'Выберите вашу команду для вызова.' }, { status: 403 });
	if (!toTeam) return NextResponse.json({ error: 'Команда соперника не найдена.' }, { status: 404 });

	const blocked = await assertTeamsCanChallenge([fromTeamId, toTeamId]);
	if (blocked) return NextResponse.json({ error: blocked }, { status: 409 });

	const challenge = await prisma.teamChallenge.create({
		data: {
			fromTeamId,
			toTeamId,
			fromUserId: user.id,
			toUserId: toTeam.createdById,
			message,
			scheduledAt: scheduledAt ? new Date(scheduledAt) : null
		}
	});

	await prisma.notification.create({
		data: {
			userId: toTeam.createdById,
			type: 'TEAM_CHALLENGE',
			title: 'Вызов на игру',
			body: `${fromTeam.name} вызывает вашу команду ${toTeam.name} на игру.${message ? ` ${message}` : ''}`,
			linkUrl: `/teams?challenge=${challenge.id}`,
			metadata: { challengeId: challenge.id, fromTeamId, toTeamId }
		}
	});

	await prisma.auditLog.create({
		data: {
			actorId: user.id,
			action: 'TEAM_CHALLENGE_CREATED',
			entity: 'TeamChallenge',
			entityId: challenge.id,
			payload: { fromTeamId, toTeamId }
		}
	});

	return NextResponse.json({ challenge }, { status: 201 });
}