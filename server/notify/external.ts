import { prisma } from '@/lib/prisma';
import { parseBroadcast } from '@/lib/broadcast';
import { collectExternalDest, deliverExternalPing, type ExternalPing } from '@/lib/external-notify';

export async function pingTournamentExternal(input: { tournamentId: string; teamIds?: string[]; ping: ExternalPing }) {
	const tournament = await prisma.tournament.findUnique({
		where: { id: input.tournamentId },
		select: { broadcast: true }
	});
	const broadcast = parseBroadcast(tournament?.broadcast);
	const teams = await prisma.team.findMany({
		where: input.teamIds?.length ? { id: { in: input.teamIds } } : { applications: { some: { tournamentId: input.tournamentId } } },
		select: { contactUrl: true, notifyWebhook: true, telegramChatId: true }
	});
	const dest = teams.reduce(
		(acc, team) => {
			const next = collectExternalDest({
				contactUrl: team.contactUrl,
				notifyWebhook: team.notifyWebhook,
				telegramChatId: team.telegramChatId,
				broadcastWebhook: broadcast.discordWebhook,
				broadcastTelegram: broadcast.telegramChatId
			});
			acc.webhooks.push(...next.webhooks);
			acc.telegramChats.push(...next.telegramChats);
			return acc;
		},
		{ webhooks: [] as string[], telegramChats: [] as string[] }
	);
	if (!teams.length) {
		const onlyBroadcast = collectExternalDest({
			broadcastWebhook: broadcast.discordWebhook,
			broadcastTelegram: broadcast.telegramChatId
		});
		dest.webhooks.push(...onlyBroadcast.webhooks);
		dest.telegramChats.push(...onlyBroadcast.telegramChats);
	}
	dest.webhooks = [...new Set(dest.webhooks)];
	dest.telegramChats = [...new Set(dest.telegramChats)];
	if (dest.webhooks.length === 0 && dest.telegramChats.length === 0) return;
	await deliverExternalPing(dest, input.ping);
}
