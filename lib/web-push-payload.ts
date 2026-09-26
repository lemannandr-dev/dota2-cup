export type WebPushPayload = {
	title: string;
	body: string;
	url?: string;
};

export function buildWebPushJson(payload: WebPushPayload) {
	return JSON.stringify({
		title: payload.title.slice(0, 120),
		body: payload.body.slice(0, 240),
		url: payload.url && payload.url.startsWith('/') ? payload.url : '/home'
	});
}
