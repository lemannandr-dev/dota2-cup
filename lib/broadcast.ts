import { collectTwitchLogins, parseTwitchLogin } from '@/lib/twitch';
import { isDiscordWebhook, parseTelegramChatId } from '@/lib/external-notify';

export type BroadcastConfig = {
	twitch: string | null;
	twitchSecondary: string | null;
	youtubeUrl: string | null;
	youtubeSecondaryUrl: string | null;
	dotaTv: string | null;
	lobbyName: string | null;
	delaySec: number;
	overlayTitle: string | null;
	discordWebhook: string | null;
	telegramChatId: string | null;
	highlights: string[];
};

const empty: BroadcastConfig = {
	twitch: null,
	twitchSecondary: null,
	youtubeUrl: null,
	youtubeSecondaryUrl: null,
	dotaTv: null,
	lobbyName: null,
	delaySec: 0,
	overlayTitle: null,
	discordWebhook: null,
	telegramChatId: null,
	highlights: []
};

export function parseYoutubeWatchId(raw?: string | null): string | null {
	if (!raw) return null;
	try {
		const url = new URL(raw.trim());
		if (url.protocol !== 'https:') return null;
		const host = url.hostname.replace(/^www\./, '').toLowerCase();
		if (host === 'youtu.be') {
			const id = url.pathname.split('/').filter(Boolean)[0] ?? '';
			return /^[\w-]{11}$/.test(id) ? id : null;
		}
		if (host !== 'youtube.com' && host !== 'm.youtube.com' && host !== 'music.youtube.com') return null;
		if (url.pathname.startsWith('/embed/')) {
			const id = url.pathname.split('/')[2] ?? '';
			return /^[\w-]{11}$/.test(id) ? id : null;
		}
		if (url.pathname === '/watch' || url.pathname === '/live') {
			const id = url.searchParams.get('v') ?? '';
			return /^[\w-]{11}$/.test(id) ? id : null;
		}
		const liveId = url.pathname.match(/^\/live\/([\w-]{11})$/);
		return liveId ? liveId[1] : null;
	} catch {
		return null;
	}
}

export function youtubeEmbedSrc(raw?: string | null): string | null {
	const id = parseYoutubeWatchId(raw);
	if (!id) return null;
	return `https://www.youtube.com/embed/${id}?autoplay=1&mute=1`;
}

export function parseDotaTv(value?: string | null): string | null {
	if (!value) return null;
	const digits = value.replace(/\s+/g, '');
	return /^\d{5,20}$/.test(digits) ? digits : null;
}

export function parseBroadcast(raw: unknown, fallbackTwitch?: string | null): BroadcastConfig {
	const record = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {};
	const delay = Number(record.delaySec ?? 0);
	return {
		twitch: parseTwitchLogin(typeof record.twitch === 'string' ? record.twitch : fallbackTwitch) ?? null,
		twitchSecondary: parseTwitchLogin(typeof record.twitchSecondary === 'string' ? record.twitchSecondary : null),
		youtubeUrl: typeof record.youtubeUrl === 'string' && parseYoutubeWatchId(record.youtubeUrl) ? record.youtubeUrl.trim() : null,
		youtubeSecondaryUrl:
			typeof record.youtubeSecondaryUrl === 'string' && parseYoutubeWatchId(record.youtubeSecondaryUrl)
				? record.youtubeSecondaryUrl.trim()
				: null,
		dotaTv: parseDotaTv(typeof record.dotaTv === 'string' ? record.dotaTv : null),
		lobbyName: typeof record.lobbyName === 'string' && record.lobbyName.trim() ? record.lobbyName.trim().slice(0, 80) : null,
		delaySec: Number.isFinite(delay) ? Math.min(600, Math.max(0, Math.round(delay))) : 0,
		overlayTitle: typeof record.overlayTitle === 'string' && record.overlayTitle.trim() ? record.overlayTitle.trim().slice(0, 80) : null,
		discordWebhook: typeof record.discordWebhook === 'string' && isDiscordWebhook(record.discordWebhook) ? record.discordWebhook.trim() : null,
		telegramChatId: parseTelegramChatId(typeof record.telegramChatId === 'string' ? record.telegramChatId : null),
		highlights: (() => {
			const raw = record.highlights;
			const lines = Array.isArray(raw) ? raw : typeof raw === 'string' ? raw.split(/\r?\n/) : [];
			const urls: string[] = [];
			for (const line of lines) {
				if (typeof line !== 'string') continue;
				const href = line.trim();
				if (!href.startsWith('https://')) continue;
				try {
					const url = new URL(href);
					if (url.protocol !== 'https:' || !url.hostname) continue;
				} catch {
					continue;
				}
				if (!urls.includes(href)) urls.push(href);
				if (urls.length >= 12) break;
			}
			return urls;
		})()
	};
}

export function broadcastFromInput(input: {
	twitchChannel?: string | null;
	twitchSecondary?: string | null;
	youtubeUrl?: string | null;
	youtubeSecondaryUrl?: string | null;
	dotaTv?: string | null;
	lobbyName?: string | null;
	delaySec?: number | null;
	overlayTitle?: string | null;
	discordWebhook?: string | null;
	telegramChatId?: string | null;
	highlights?: unknown;
	previous?: unknown;
}): BroadcastConfig {
	const previous = parseBroadcast(input.previous);
	return parseBroadcast(
		{
			...previous,
			twitch: input.twitchChannel,
			twitchSecondary: input.twitchSecondary,
			youtubeUrl: input.youtubeUrl,
			youtubeSecondaryUrl: input.youtubeSecondaryUrl,
			dotaTv: input.dotaTv,
			lobbyName: input.lobbyName,
			delaySec: input.delaySec,
			overlayTitle: input.overlayTitle,
			discordWebhook: input.discordWebhook,
			telegramChatId: input.telegramChatId,
			highlights: input.highlights ?? previous.highlights
		},
		input.twitchChannel
	);
}

export function hasOfficialDesk(config: BroadcastConfig) {
	return Boolean(config.twitch || config.youtubeUrl || config.twitchSecondary || config.youtubeSecondaryUrl);
}

export function officialTwitchLogins(broadcast: unknown, ...legacy: Array<string | null | undefined>) {
	const config = parseBroadcast(broadcast);
	return collectTwitchLogins(config.twitch, config.twitchSecondary, ...legacy);
}

export function broadcastSources(config: BroadcastConfig) {
	const sources: Array<{ id: string; label: string; kind: 'twitch' | 'youtube'; twitch?: string; youtube?: string }> = [];
	if (config.twitch) sources.push({ id: 'twitch', label: 'Стол · Twitch', kind: 'twitch', twitch: config.twitch });
	if (config.twitchSecondary) sources.push({ id: 'twitch-2', label: 'Второй язык · Twitch', kind: 'twitch', twitch: config.twitchSecondary });
	if (config.youtubeUrl) sources.push({ id: 'youtube', label: 'Стол · YouTube', kind: 'youtube', youtube: config.youtubeUrl });
	if (config.youtubeSecondaryUrl) {
		sources.push({ id: 'youtube-2', label: 'Второй язык · YouTube', kind: 'youtube', youtube: config.youtubeSecondaryUrl });
	}
	return sources;
}

export { empty as emptyBroadcast };
