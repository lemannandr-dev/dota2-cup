import { prisma } from '@/lib/prisma';

export async function notifyScrimParties(matchId: string, title: string, body: string) {
	const challenge = await prisma.teamChallenge.findFirst({
		where: { matchId },
		select: { id: true, fromUserId: true, toUserId: true }
	});
	if (!challenge) return;
	const linkUrl = `/teams?challenge=${challenge.id}`;
	await prisma.notification.createMany({
		data: [challenge.fromUserId, challenge.toUserId].map((userId) => ({
			userId,
			type: 'TEAM_CHALLENGE',
			title,
			body,
			linkUrl
		}))
	});
}
