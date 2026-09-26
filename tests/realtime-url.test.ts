import { describe, expect, it, vi } from 'vitest';
import { resolveRealtimeUrl } from '@/lib/realtime-url';
import { coalesceCalls, uniqueTournamentIds } from '@/lib/realtime-client';

describe('realtime URL', () => {
	it('maps localhost to the Android emulator host without changing its port', () => {
		expect(resolveRealtimeUrl('http://localhost:3003', 'http://10.0.2.2:3002/tournaments/a')).toBe('http://10.0.2.2:3003');
		expect(resolveRealtimeUrl('http://localhost:3003', 'http://localhost:3002/tournaments/a')).toBe('http://localhost:3003');
	});

	it('keeps an explicit production realtime domain', () => {
		expect(resolveRealtimeUrl('https://live.example.com', 'https://arena.example.com/home')).toBe('https://live.example.com');
		expect(resolveRealtimeUrl('not a URL', 'https://arena.example.com/home')).toBeNull();
	});
});

describe('realtime client helpers', () => {
	it('uniqueTournamentIds dedupes and sorts', () => {
		expect(uniqueTournamentIds(['b', null, 'a', 'b', undefined, ''])).toEqual(['a', 'b']);
	});

	it('coalesceCalls collapses bursts within wait window', async () => {
		vi.useFakeTimers();
		const fn = vi.fn();
		const trigger = coalesceCalls(fn, 150);
		trigger();
		trigger();
		trigger();
		expect(fn).not.toHaveBeenCalled();
		await vi.advanceTimersByTimeAsync(150);
		expect(fn).toHaveBeenCalledTimes(1);
		trigger.cancel();
		vi.useRealTimers();
	});
});

