const STORAGE_KEY = 'aegis.offlineQueue.v1';

export type OfflineMutation = {
	id: string;
	url: string;
	method: string;
	body?: string;
	idempotencyKey: string;
	label: string;
	createdAt: number;
};

function readQueue(): OfflineMutation[] {
	if (typeof window === 'undefined') return [];
	try {
		const raw = window.sessionStorage.getItem(STORAGE_KEY);
		if (!raw) return [];
		const parsed = JSON.parse(raw) as OfflineMutation[];
		return Array.isArray(parsed) ? parsed : [];
	} catch {
		return [];
	}
}

function writeQueue(items: OfflineMutation[]) {
	if (typeof window === 'undefined') return;
	try {
		window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(items.slice(0, 40)));
	} catch {
		/* quota */
	}
}

export function listOfflineQueue() {
	return readQueue();
}

export function enqueueOfflineMutation(input: Omit<OfflineMutation, 'id' | 'createdAt'> & { id?: string }) {
	const item: OfflineMutation = {
		id: input.id ?? `oq-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
		url: input.url,
		method: input.method,
		body: input.body,
		idempotencyKey: input.idempotencyKey,
		label: input.label,
		createdAt: Date.now()
	};
	const next = [...readQueue().filter((row) => row.idempotencyKey !== item.idempotencyKey), item];
	writeQueue(next);
	return item;
}

export function removeOfflineMutation(id: string) {
	writeQueue(readQueue().filter((row) => row.id !== id));
}

export async function replayOfflineQueue(fetchImpl: typeof fetch = fetch): Promise<{ ok: number; fail: number; errors: string[] }> {
	const queue = readQueue();
	let ok = 0;
	let fail = 0;
	const errors: string[] = [];
	const remaining: OfflineMutation[] = [];

	for (const item of queue) {
		try {
			const res = await fetchImpl(item.url, {
				method: item.method,
				credentials: 'same-origin',
				headers: {
					'Content-Type': 'application/json',
					Origin: typeof window !== 'undefined' ? window.location.origin : '',
					'Idempotency-Key': item.idempotencyKey
				},
				body: item.body
			});
			if (!res.ok) {
				fail += 1;
				const body = await res.json().catch(() => null);
				errors.push(body?.error || `${item.label}: ${res.status}`);
				remaining.push(item);
				continue;
			}
			ok += 1;
		} catch (err) {
			fail += 1;
			errors.push(err instanceof Error ? err.message : String(err));
			remaining.push(item);
		}
	}

	writeQueue(remaining);
	return { ok, fail, errors };
}

/** Fetch wrapper: on network failure enqueue and return a synthetic offline result. */
export async function fetchWithOfflineQueue(
	input: {
		url: string;
		method?: string;
		body?: unknown;
		idempotencyKey: string;
		label: string;
	},
	fetchImpl: typeof fetch = fetch
): Promise<{ ok: boolean; offline?: boolean; status: number; json: unknown }> {
	const method = input.method ?? 'POST';
	const body = input.body === undefined ? undefined : JSON.stringify(input.body);
	try {
		const res = await fetchImpl(input.url, {
			method,
			credentials: 'same-origin',
			headers: {
				'Content-Type': 'application/json',
				Origin: typeof window !== 'undefined' ? window.location.origin : '',
				'Idempotency-Key': input.idempotencyKey
			},
			body
		});
		const json = await res.json().catch(() => null);
		return { ok: res.ok, status: res.status, json };
	} catch (err) {
		if (typeof navigator !== 'undefined' && navigator.onLine === false) {
			enqueueOfflineMutation({
				url: input.url,
				method,
				body,
				idempotencyKey: input.idempotencyKey,
				label: input.label
			});
			return { ok: false, offline: true, status: 0, json: { error: 'offline_queued' } };
		}
		if (err instanceof TypeError) {
			enqueueOfflineMutation({
				url: input.url,
				method,
				body,
				idempotencyKey: input.idempotencyKey,
				label: input.label
			});
			return { ok: false, offline: true, status: 0, json: { error: 'offline_queued' } };
		}
		throw err;
	}
}
