import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import {
	enqueueOfflineMutation,
	listOfflineQueue,
	replayOfflineQueue,
	fetchWithOfflineQueue,
	removeOfflineMutation
} from '@/lib/offline-queue';

const STORAGE_KEY = 'aegis.offlineQueue.v1';

function mockSessionStorage() {
	const store = new Map<string, string>();
	const storage = {
		getItem: (key: string) => store.get(key) ?? null,
		setItem: (key: string, value: string) => {
			store.set(key, value);
		},
		removeItem: (key: string) => {
			store.delete(key);
		},
		clear: () => store.clear(),
		get length() {
			return store.size;
		},
		key: (index: number) => [...store.keys()][index] ?? null
	};
	vi.stubGlobal('sessionStorage', storage);
	vi.stubGlobal('window', { sessionStorage: storage, location: { origin: 'http://localhost' } });
	return store;
}

describe('offline-queue', () => {
	let store: Map<string, string>;

	beforeEach(() => {
		store = mockSessionStorage();
		vi.stubGlobal('navigator', { onLine: true });
	});

	afterEach(() => {
		vi.unstubAllGlobals();
	});

	it('serializes enqueue and dedupes by idempotency key', () => {
		enqueueOfflineMutation({
			url: '/api/x',
			method: 'POST',
			body: '{"a":1}',
			idempotencyKey: 'k1',
			label: 'Test'
		});
		enqueueOfflineMutation({
			url: '/api/x',
			method: 'POST',
			body: '{"a":2}',
			idempotencyKey: 'k1',
			label: 'Test2'
		});
		const list = listOfflineQueue();
		expect(list).toHaveLength(1);
		expect(list[0].body).toBe('{"a":2}');
		expect(JSON.parse(store.get(STORAGE_KEY) || '[]')).toHaveLength(1);
	});

	it('replays successes and keeps failures', async () => {
		enqueueOfflineMutation({
			url: '/api/ok',
			method: 'POST',
			idempotencyKey: 'ok',
			label: 'Ok'
		});
		enqueueOfflineMutation({
			url: '/api/fail',
			method: 'POST',
			idempotencyKey: 'fail',
			label: 'Fail'
		});
		const fetchImpl = vi.fn(async (url: string) => {
			if (String(url).includes('fail')) {
				return { ok: false, status: 500, json: async () => ({ error: 'boom' }) } as Response;
			}
			return { ok: true, status: 200, json: async () => ({ ok: true }) } as Response;
		});
		const result = await replayOfflineQueue(fetchImpl as typeof fetch);
		expect(result.ok).toBe(1);
		expect(result.fail).toBe(1);
		expect(listOfflineQueue()).toHaveLength(1);
		expect(listOfflineQueue()[0].idempotencyKey).toBe('fail');
	});

	it('fetchWithOfflineQueue enqueues on TypeError', async () => {
		vi.stubGlobal('navigator', { onLine: false });
		const fetchImpl = vi.fn(async () => {
			throw new TypeError('Failed to fetch');
		});
		const result = await fetchWithOfflineQueue(
			{ url: '/api/ready', method: 'POST', body: { teamId: 't1' }, idempotencyKey: 'r1', label: 'Ready' },
			fetchImpl as typeof fetch
		);
		expect(result.offline).toBe(true);
		expect(listOfflineQueue()).toHaveLength(1);
		removeOfflineMutation(listOfflineQueue()[0].id);
		expect(listOfflineQueue()).toHaveLength(0);
	});
});
