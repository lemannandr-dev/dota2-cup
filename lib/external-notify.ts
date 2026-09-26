export type ExternalPing = {
	title: string;
	body: string;
	linkUrl: string;
};

export type ExternalDest = {
	webhooks: string[];
	telegramChats: string[];
};

export function isDiscordWebhook(url?: string | null): url is string {
	if (!url) return false;
	try {
		const parsed = new URL(url.trim());
		return parsed.protocol === 'https:' && parsed.hostname === 'discord.com' && parsed.pathname.includes('/api/webhooks/');
	} catch {
		return false;
	}
}

export function parseTelegramChatId(raw?: string | null) {
	if (!raw) return null;
	const value = raw.trim();
	if (/^-?\d{5,20}$/.test(value)) return value;
	return null;
}

export function collectExternalDest(input: {
	contactUrl?: string | null;
	notifyWebhook?: string | null;
	telegramChatId?: string | null;
	broadcastWebhook?: string | null;
	broadcastTelegram?: string | null;
}): ExternalDest {
	const webhooks = [input.notifyWebhook, input.broadcastWebhook, input.contactUrl].filter(isDiscordWebhook);
	const telegramChats = [input.telegramChatId, input.broadcastTelegram].map(parseTelegramChatId).filter((id): id is string => Boolean(id));
	return { webhooks: [...new Set(webhooks)], telegramChats: [...new Set(telegramChats)] };
}

export function discordWebhookBody(ping: ExternalPing, origin: string) {
	const url = ping.linkUrl.startsWith('http') ? ping.linkUrl : `${origin}${ping.linkUrl}`;
	return {
		username: 'Aegis Arena',
		content: `**${ping.title}**\n${ping.body}\n${url}`
	};
}

export function telegramMessage(ping: ExternalPing, origin: string) {
	const url = ping.linkUrl.startsWith('http') ? ping.linkUrl : `${origin}${ping.linkUrl}`;
	return `${ping.title}\n${ping.body}\n${url}`;
}

export async function deliverExternalPing(dest: ExternalDest, ping: ExternalPing) {
	const origin = process.env.APP_URL || process.env.NEXTAUTH_URL || 'http://localhost:3002';
	const token = process.env.TELEGRAM_BOT_TOKEN;
	await Promise.allSettled([
		...dest.webhooks.map((webhook) =>
			fetch(webhook, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(discordWebhookBody(ping, origin))
			})
		),
		...(token
			? dest.telegramChats.map((chatId) =>
					fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
						method: 'POST',
						headers: { 'Content-Type': 'application/json' },
						body: JSON.stringify({ chat_id: chatId, text: telegramMessage(ping, origin), disable_web_page_preview: true })
					})
				)
			: [])
	]);
}
