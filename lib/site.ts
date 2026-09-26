export const SITE_NAME = 'Aegis Arena';
export const SITE_TAGLINE = 'Турнирная платформа сообщества для пятёрок Dota 2';

export function siteUrl() {
	const raw = process.env.APP_URL || process.env.NEXTAUTH_URL || 'http://localhost:3002';
	return raw.replace(/\/$/, '');
}

export function teamDeskHref(teamId: string) {
	return `/teams?team=${encodeURIComponent(teamId)}`;
}

export function playerCardHref(userId: string) {
	return `/players/${userId}`;
}

export function absoluteUrl(path = '/') {
	if (path.startsWith('http://') || path.startsWith('https://')) return path;
	return `${siteUrl()}${path.startsWith('/') ? path : `/${path}`}`;
}

export const defaultDescription =
	'Aegis Arena — независимая турнирная платформа сообщества Dota 2: Steam OpenID, подтверждённая пятёрка, сетка, рейтинг арены +16/−12 из реальных пар и кубок после финала. Приз только если фонд зарезервирован на эскроу. Проект не связан с Valve.';
