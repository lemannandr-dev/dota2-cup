import { afterEach, describe, expect, it, vi } from 'vitest';
import { fetchDotaProfileAnalyticsBySteamId } from '@/lib/dota-stats';

vi.mock('@/server/cache/redis', () => ({ getCachedJson: vi.fn(async () => null), setCachedJson: vi.fn(async () => undefined) }));
afterEach(() => vi.unstubAllGlobals());

describe('catalog analytics deadline', () => {
	it('aborts all external requests and keeps the catalog usable when OpenDota stalls', async () => {
		const signals: AbortSignal[] = [];
		vi.stubGlobal('fetch', vi.fn((_url: string, init: RequestInit) => new Promise((_resolve, reject) => {
			const signal = init.signal!;
			signals.push(signal);
			signal.addEventListener('abort', () => reject(signal.reason), { once: true });
		})));
		expect(await fetchDotaProfileAnalyticsBySteamId('76561198835548729', { timeoutMs: 30 })).toBeNull();
		expect(signals).toHaveLength(5);
		expect(signals.every((signal) => signal.aborted)).toBe(true);
	});
});
