const CDN = 'https://cdn.cloudflare.steamstatic.com/apps/dota2/images/dota_react/heroes';
const CDN_CLASSIC = 'https://cdn.cloudflare.steamstatic.com/apps/dota2/images/heroes';

export function heroSlug(apiName: string) {
	return apiName
		.replace(/^npc_dota_hero_/, '')
		.replace(/[^a-z0-9_]+/gi, '_')
		.toLowerCase();
}

/** Local-first hero art URL (public/heroes). CDN used as fallback in img onError. */
export function heroImage(apiName: string, variant: 'vert' | 'landscape' = 'vert') {
	const slug = heroSlug(apiName);
	if (!slug) return null;
	if (variant === 'vert') return `/heroes/${slug}_vert.webp`;
	return `/heroes/${slug}.webp`;
}

export function heroImageCdn(apiName: string, variant: 'vert' | 'landscape' = 'vert') {
	const slug = heroSlug(apiName);
	if (!slug) return null;
	if (variant === 'vert') return `${CDN_CLASSIC}/${slug}_vert.jpg`;
	return `${CDN}/${slug}.png`;
}

export function heroImageFromApiName(apiName: string | null | undefined) {
	if (!apiName) return null;
	return heroImage(apiName, 'vert');
}

/** Parse `axe` from /heroes/axe_vert.webp or Steam CDN URLs. */
export function heroSlugFromSrc(src: string) {
	const match = src.match(/([a-z0-9_]+?)(?:_vert)?\.(?:png|jpe?g|webp)(?:\?|$)/i);
	return match ? match[1].toLowerCase() : null;
}
