export function resolveRealtimeUrl(configured: string | undefined, pageUrl: string) {
	if (!configured) return null;
	try {
		const socketUrl = new URL(configured);
		const page = new URL(pageUrl);
		if (['localhost', '127.0.0.1'].includes(socketUrl.hostname) && !['localhost', '127.0.0.1'].includes(page.hostname)) {
			socketUrl.hostname = page.hostname;
		}
		return socketUrl.toString().replace(/\/$/, '');
	} catch {
		return null;
	}
}

