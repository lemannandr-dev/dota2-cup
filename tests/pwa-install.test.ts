import { describe, expect, it } from 'vitest';
import { isIosDevice, isStandaloneDisplay } from '@/lib/pwa-install';

describe('PWA install detection', () => {
	it('detects current iPhone and iPad user agents', () => {
		expect(isIosDevice('Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X)')).toBe(true);
		expect(isIosDevice('Mozilla/5.0', 'MacIntel', 5)).toBe(true);
	});

	it('does not mark Android as iOS', () => {
		expect(isIosDevice('Mozilla/5.0 (Linux; Android 15; Pixel 9)', 'Linux armv8l', 5)).toBe(false);
	});

	it('recognizes browser and iOS standalone modes', () => {
		expect(isStandaloneDisplay(true, false)).toBe(true);
		expect(isStandaloneDisplay(false, true)).toBe(true);
		expect(isStandaloneDisplay(false, false)).toBe(false);
	});
});
