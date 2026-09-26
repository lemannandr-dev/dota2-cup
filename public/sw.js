const CACHE_NAME = 'aegis-arena-shell-v3';
const OFFLINE_URL = '/offline.html';
const SHELL_ASSETS = [
	OFFLINE_URL,
	'/icons/aegis-arena-48.png',
	'/icons/aegis-arena-180.png',
	'/icons/aegis-arena-192.png',
	'/icons/aegis-arena-512.png'
];

self.addEventListener('install', (event) => {
	event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(SHELL_ASSETS)));
	self.skipWaiting();
});

self.addEventListener('activate', (event) => {
	event.waitUntil(
		caches.keys().then((keys) =>
			Promise.all(keys.filter((key) => key.startsWith('aegis-arena-shell-') && key !== CACHE_NAME).map((key) => caches.delete(key)))
		)
	);
	self.clients.claim();
});

self.addEventListener('fetch', (event) => {
	const url = new URL(event.request.url);
	if (event.request.method !== 'GET' || url.origin !== self.location.origin || url.pathname.startsWith('/api/')) return;
	if (SHELL_ASSETS.includes(url.pathname)) {
		event.respondWith(caches.match(url.pathname).then((cached) => cached || fetch(event.request)));
		return;
	}
	if (event.request.mode !== 'navigate') return;

	event.respondWith(
		fetch(event.request).catch(async () => {
			const fallback = await caches.match(OFFLINE_URL);
			return fallback || Response.error();
		})
	);
});

self.addEventListener('push', (event) => {
	let payload = { title: 'Aegis Arena', body: 'Новое уведомление на арене', url: '/home' };
	try {
		if (event.data) payload = { ...payload, ...event.data.json() };
	} catch {
		/* ignore malformed push */
	}
	event.waitUntil(
		self.registration.showNotification(payload.title || 'Aegis Arena', {
			body: payload.body || '',
			icon: '/icons/aegis-arena-192.png',
			badge: '/icons/aegis-arena-192.png',
			data: { url: payload.url || '/home' }
		})
	);
});

self.addEventListener('notificationclick', (event) => {
	event.notification.close();
	const target = event.notification.data?.url || '/home';
	event.waitUntil(
		self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
			for (const client of clients) {
				if ('focus' in client) {
					client.navigate?.(target);
					return client.focus();
				}
			}
			return self.clients.openWindow(target);
		})
	);
});
