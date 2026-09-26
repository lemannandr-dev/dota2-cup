import { prisma } from '@/lib/prisma';
import { matchNotifyRows, type MatchNotifyInput } from '@/lib/match-notify';
import { listRefereeUserIds } from '@/server/tournaments/staff';

export async function notifyMatchParties(input: MatchNotifyInput) {
	const needsBench = input.kind === 'score_dispute' || input.kind === 'dispute_opened';
	const refereeIds = input.refereeIds ?? (needsBench ? await listRefereeUserIds(input.tournamentId) : undefined);
	const rows = matchNotifyRows({ ...input, refereeIds });
	if (rows.length === 0) return;
	await prisma.notification.createMany({ data: rows });
	const first = rows[0];
	const { pingTournamentExternal } = await import('@/server/notify/external');
	await pingTournamentExternal({
		tournamentId: input.tournamentId,
		ping: { title: first.title, body: first.body, linkUrl: first.linkUrl }
	}).catch((error) => console.error('external match ping failed', error));
	const { sendWebPushToUsers } = await import('@/server/notify/web-push');
	await sendWebPushToUsers(
		rows.map((row) => row.userId),
		{ title: first.title, body: first.body, url: first.linkUrl }
	).catch((error) => console.error('web push match ping failed', error));
}
