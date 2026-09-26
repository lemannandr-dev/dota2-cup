import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCurrentSteamUser } from '@/lib/steam-session';
import { z } from 'zod';
import { assertTeamsCanChallenge, openScrimMatch } from '@/server/scrims/open';
import { canSubmitMatchScore } from '@/lib/access-policy';
import { deputyIdFromMembers } from '@/lib/team-roles';

const actionSchema = z.object({
	action: z.enum(['ACCEPTED', 'DECLINED', 'COUNTERED']),
	message: z.string().trim().max(500).optional().transform((value) => value || undefined),
	scheduledAt: z.string().datetime().optional()
});

async function getChallengeForUser(id: string, userId: string) {
	const challenge = await prisma.teamChallenge.findFirst({
		where: { id, OR: [{ fromUserId: userId }, { toUserId: userId }] },
		include: { match: { select: { id: true, status: true, scoreA: true, scoreB: true } } }
	});
	if (!challenge) return null;

	const [fromTeam, toTeam] = await Promise.all([
		prisma.team.findUnique({
			where: { id: challenge.fromTeamId },
			select: { id: true, name: true, tag: true, createdById: true, members: { where: { confirmed: true }, select: { userId: true, role: true } } }
		}),
		prisma.team.findUnique({
			where: { id: challenge.toTeamId },
			select: { id: true, name: true, tag: true, createdById: true, members: { where: { confirmed: true }, select: { userId: true, role: true } } }
		})
	]);
	const canReport = Boolean(
		fromTeam &&
			toTeam &&
			canSubmitMatchScore(
				userId,
				fromTeam.createdById,
				toTeam.createdById,
				deputyIdFromMembers(fromTeam.members, fromTeam.createdById),
				deputyIdFromMembers(toTeam.members, toTeam.createdById)
			)
	);

	return { ...challenge, fromTeam, toTeam, canReport };
}

export async function GET(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
	const user = await getCurrentSteamUser();
	if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

	const { id } = await params;
	const challenge = await getChallengeForUser(id, user.id);
	if (!challenge) return NextResponse.json({ error: 'not found' }, { status: 404 });

	return NextResponse.json({ challenge }, { status: 200 });
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
	const user = await getCurrentSteamUser();
	if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

	const { id } = await params;
	const parsed = actionSchema.safeParse(await req.json());
	if (!parsed.success) {
		return NextResponse.json({ error: 'Validation failed', issues: parsed.error.issues }, { status: 400 });
	}

	const challenge = await getChallengeForUser(id, user.id);
	if (!challenge || !challenge.fromTeam || !challenge.toTeam) {
		return NextResponse.json({ error: 'not found' }, { status: 404 });
	}
	if (challenge.toUserId !== user.id) {
		return NextResponse.json({ error: 'Ответить на вызов может только лидер приглашённой команды.' }, { status: 403 });
	}
	if (!['PENDING', 'COUNTERED'].includes(challenge.status)) {
		return NextResponse.json({ error: 'Этот вызов уже обработан.' }, { status: 400 });
	}

	const { action, message, scheduledAt } = parsed.data;
	if (action === 'ACCEPTED') {
		const blocked = await assertTeamsCanChallenge([challenge.fromTeamId, challenge.toTeamId], id);
		if (blocked) return NextResponse.json({ error: blocked }, { status: 409 });
	}

	const updated = await prisma.teamChallenge.update({
		where: { id },
		data: {
			status: action,
			message: message ?? challenge.message,
			scheduledAt: scheduledAt ? new Date(scheduledAt) : challenge.scheduledAt
		}
	});
	const matchId = action === 'ACCEPTED' ? await openScrimMatch({ challengeId: id, fromTeamId: challenge.fromTeamId, toTeamId: challenge.toTeamId }) : null;

	const actionText = action === 'ACCEPTED' ? 'приняла вызов' : action === 'DECLINED' ? 'отклонила вызов' : 'предложила другое время';
	await prisma.notification.create({
		data: {
			userId: challenge.fromUserId,
			type: 'TEAM_CHALLENGE_RESPONSE',
			title: action === 'ACCEPTED' ? 'Вызов принят' : action === 'DECLINED' ? 'Вызов отклонён' : 'Предложено другое время',
			body:
				action === 'ACCEPTED'
					? `${challenge.toTeam.name} приняла вызов. Это скрим без приза: оба капитана сдают один счёт, арена +16/−12.`
					: `${challenge.toTeam.name} ${actionText} от ${challenge.fromTeam.name}.${message ? ` ${message}` : ''}`,
			linkUrl: `/teams?challenge=${id}`,
			metadata: { challengeId: id, fromTeamId: challenge.fromTeamId, toTeamId: challenge.toTeamId, status: action }
		}
	});

	await prisma.auditLog.create({
		data: {
			actorId: user.id,
			action: `TEAM_CHALLENGE_${action}`,
			entity: 'TeamChallenge',
			entityId: id,
			payload: { message, scheduledAt }
		}
	});

	return NextResponse.json({ challenge: { ...updated, matchId: matchId ?? updated.matchId } }, { status: 200 });
}