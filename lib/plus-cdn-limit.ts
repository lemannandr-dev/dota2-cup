export const PLUS_CDN_MAX_PER_HOUR = 20;
export const PLUS_CDN_WINDOW_SECONDS = 60 * 60;

export function plusCdnKey(userId: string) {
	return `plus-cdn:downloads:${userId}`;
}

export function canConsumePlusCdn(used: number, max = PLUS_CDN_MAX_PER_HOUR) {
	if (used >= max) {
		return { ok: false as const, code: 'cdn_limit' as const, used, max, remaining: 0 };
	}
	return { ok: true as const, used, max, remaining: max - used };
}
