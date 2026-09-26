import { parseYoutubeWatchId, youtubeEmbedSrc } from '@/lib/broadcast';
import { parseTwitchLogin } from '@/lib/twitch';

export type CupHighlightKind = 'youtube' | 'twitch' | 'kick' | 'vk' | 'rutube' | 'link';

export type CupHighlight = {
	id: string;
	label: string;
	kind: CupHighlightKind;
	url: string;
	embed: string | null;
};

const HOST_LABEL: Record<string, string> = {
	'youtube.com': 'YouTube',
	'youtu.be': 'YouTube',
	'm.youtube.com': 'YouTube',
	'twitch.tv': 'Twitch',
	'clips.twitch.tv': 'Twitch',
	'kick.com': 'Kick',
	'vk.com': 'VK',
	'vk.ru': 'VK',
	'rutube.ru': 'Rutube',
	'vimeo.com': 'Vimeo'
};

function hostOf(url: string) {
	try {
		return new URL(url).hostname.replace(/^www\./, '').toLowerCase();
	} catch {
		return '';
	}
}

export function isHttpsMediaUrl(raw: string) {
	try {
		const url = new URL(raw.trim());
		return url.protocol === 'https:' && Boolean(url.hostname);
	} catch {
		return false;
	}
}

export function parseHighlightLines(raw: unknown): string[] {
	const chunks = Array.isArray(raw)
		? raw
		: typeof raw === 'string'
			? raw.split(/\r?\n/)
			: [];
	const urls: string[] = [];
	for (const chunk of chunks) {
		if (typeof chunk !== 'string') continue;
		const line = chunk.trim();
		if (!isHttpsMediaUrl(line)) continue;
		if (!urls.includes(line)) urls.push(line);
		if (urls.length >= 12) break;
	}
	return urls;
}

function twitchVideoId(url: URL) {
	const fromPath = url.pathname.match(/\/videos\/(\d+)/);
	if (fromPath) return fromPath[1];
	return url.searchParams.get('video') ?? url.searchParams.get('v');
}

function twitchClipSlug(url: URL) {
	if (url.hostname.replace(/^www\./, '') === 'clips.twitch.tv') {
		return url.pathname.split('/').filter(Boolean)[0] ?? null;
	}
	const clip = url.pathname.match(/\/clip\/([A-Za-z0-9_-]+)/);
	return clip?.[1] ?? null;
}

export function parseCupHighlight(url: string, index = 0): CupHighlight | null {
	if (!isHttpsMediaUrl(url)) return null;
	const href = url.trim();
	const host = hostOf(href);
	const youtube = parseYoutubeWatchId(href);
	if (youtube) {
		return {
			id: `yt-${youtube}-${index}`,
			label: `YouTube · момент ${index + 1}`,
			kind: 'youtube',
			url: href,
			embed: youtubeEmbedSrc(href)?.replace('autoplay=1&mute=1', 'autoplay=0') ?? null
		};
	}
	try {
		const parsed = new URL(href);
		const clip = twitchClipSlug(parsed);
		if (clip) {
			return {
				id: `tw-clip-${clip}-${index}`,
				label: `Twitch клип · ${index + 1}`,
				kind: 'twitch',
				url: href,
				embed: null
			};
		}
		const video = twitchVideoId(parsed);
		if (host.endsWith('twitch.tv') && video) {
			return {
				id: `tw-vod-${video}-${index}`,
				label: `Twitch VOD · ${index + 1}`,
				kind: 'twitch',
				url: href,
				embed: null
			};
		}
		if (host.endsWith('twitch.tv')) {
			const login = parseTwitchLogin(href);
			if (login) {
				return {
					id: `tw-${login}-${index}`,
					label: `Twitch · ${login}`,
					kind: 'twitch',
					url: href,
					embed: null
				};
			}
		}
	} catch {
		return null;
	}
	const kind: CupHighlightKind = host.includes('kick.')
		? 'kick'
		: host.startsWith('vk.')
			? 'vk'
			: host.includes('rutube')
				? 'rutube'
				: 'link';
	return {
		id: `ext-${index}-${host}`,
		label: `${HOST_LABEL[host] ?? (host || 'Ссылка')} · ${index + 1}`,
		kind,
		url: href,
		embed: null
	};
}

export function twitchHighlightSrc(url: string, parent: string) {
	try {
		const parsed = new URL(url);
		const clip = twitchClipSlug(parsed);
		if (clip) {
			return `https://clips.twitch.tv/embed?clip=${encodeURIComponent(clip)}&parent=${encodeURIComponent(parent)}&autoplay=false`;
		}
		const video = twitchVideoId(parsed);
		if (video) {
			return `https://player.twitch.tv/?video=${encodeURIComponent(video)}&parent=${encodeURIComponent(parent)}&autoplay=false`;
		}
		const login = parseTwitchLogin(url);
		if (login) {
			return `https://player.twitch.tv/?channel=${encodeURIComponent(login)}&parent=${encodeURIComponent(parent)}&muted=true`;
		}
	} catch {
		return null;
	}
	return null;
}

export function buildCupHighlights(input: { urls?: unknown; youtubeUrl?: string | null; youtubeSecondaryUrl?: string | null }) {
	const lines = [
		...parseHighlightLines(input.urls),
		...(input.youtubeUrl ? [input.youtubeUrl] : []),
		...(input.youtubeSecondaryUrl ? [input.youtubeSecondaryUrl] : [])
	];
	const seen = new Set<string>();
	const items: CupHighlight[] = [];
	for (const line of lines) {
		const row = parseCupHighlight(line, items.length);
		if (!row || seen.has(row.url)) continue;
		seen.add(row.url);
		items.push(row);
	}
	return items;
}
