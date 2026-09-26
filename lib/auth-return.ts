export function safeAuthReturn(value?: string | null): string {
	if (typeof value !== 'string' || !value || value.length > 2048 || !value.startsWith('/') || value.startsWith('//')) return '/home';
	try {
		const decoded = decodeURIComponent(value);
		if (/[\\\u0000-\u001f\u007f]/.test(decoded) || decoded.startsWith('//')) return '/home';
		const url = new URL(value, 'https://arena.invalid');
		if (url.origin !== 'https://arena.invalid' || /^\/(api|login|register)(\/|$)/.test(url.pathname)) return '/home';
		return `${url.pathname}${url.search}${url.hash}`;
	} catch { return '/home'; }
}

export function steamLoginHref(next?: string | null) {
	return `/api/auth/steam?next=${encodeURIComponent(safeAuthReturn(next))}`;
}
