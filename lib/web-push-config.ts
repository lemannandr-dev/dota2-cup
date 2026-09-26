export function vapidPublicKey() {
	return process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY?.trim() || process.env.VAPID_PUBLIC_KEY?.trim() || '';
}

export function vapidPrivateKey() {
	return process.env.VAPID_PRIVATE_KEY?.trim() || '';
}

export function vapidSubject() {
	return process.env.VAPID_SUBJECT?.trim() || 'mailto:security@aegisarena.local';
}

export function webPushConfigured() {
	return Boolean(vapidPublicKey() && vapidPrivateKey());
}
