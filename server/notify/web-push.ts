import { prisma } from '@/lib/prisma';
import { buildWebPushJson, type WebPushPayload } from '@/lib/web-push-payload';
import { vapidPrivateKey, vapidPublicKey, vapidSubject, webPushConfigured } from '@/lib/web-push-config';

export type { WebPushPayload };
export { buildWebPushJson };

type WebPushModule = {
	setVapidDetails: (subject: string, publicKey: string, privateKey: string) => void;
	sendNotification: (
		subscription: { endpoint: string; keys: { p256dh: string; auth: string } },
		payload: string,
		options?: { TTL?: number; urgency?: string }
	) => Promise<unknown>;
};

let vapidReady = false;
let webPushModule: WebPushModule | null | undefined;

async function loadWebPush(): Promise<WebPushModule | null> {
	if (webPushModule !== undefined) return webPushModule;
	try {
		const mod = await import('web-push');
		webPushModule = (mod.default ?? mod) as WebPushModule;
	} catch {
		webPushModule = null;
	}
	return webPushModule;
}

async function ensureVapid() {
	if (!webPushConfigured()) return null;
	const webpush = await loadWebPush();
	if (!webpush) return null;
	if (!vapidReady) {
		webpush.setVapidDetails(vapidSubject(), vapidPublicKey(), vapidPrivateKey());
		vapidReady = true;
	}
	return webpush;
}

export async function sendWebPushToUsers(userIds: string[], payload: WebPushPayload) {
	const unique = Array.from(new Set(userIds.filter(Boolean)));
	const webpush = await ensureVapid();
	if (!webpush || unique.length === 0) return { sent: 0, gone: 0 };
	const subs = await prisma.pushSubscription.findMany({
		where: { userId: { in: unique } },
		select: { id: true, endpoint: true, p256dh: true, auth: true }
	});
	if (subs.length === 0) return { sent: 0, gone: 0 };

	const body = buildWebPushJson(payload);
	let sent = 0;
	const gone: string[] = [];

	await Promise.all(
		subs.map(async (sub) => {
			try {
				await webpush.sendNotification(
					{
						endpoint: sub.endpoint,
						keys: { p256dh: sub.p256dh, auth: sub.auth }
					},
					body,
					{ TTL: 60 * 60, urgency: 'normal' }
				);
				sent += 1;
			} catch (error) {
				const status =
					typeof error === 'object' && error && 'statusCode' in error
						? Number((error as { statusCode?: number }).statusCode)
						: 0;
				if (status === 404 || status === 410) gone.push(sub.id);
			}
		})
	);

	if (gone.length > 0) {
		await prisma.pushSubscription.deleteMany({ where: { id: { in: gone } } }).catch(() => undefined);
	}
	return { sent, gone: gone.length };
}
