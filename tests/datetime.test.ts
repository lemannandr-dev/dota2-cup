import { describe, expect, it } from 'vitest';
import { formatMoscowDateTime, formatMoscowDay, formatMoscowLabel } from '@/lib/datetime';

describe('moscow clock', () => {
	it('adds three hours without using the browser locale', () => {
		expect(formatMoscowLabel('2026-08-23T13:39:51.000Z')).toBe('23.08, 16:39');
		expect(formatMoscowDateTime('2026-08-23T13:39:51.000Z')).toBe('23.08.2026, 16:39:51 МСК');
		expect(formatMoscowDateTime('2026-08-23T13:39:51.000Z')).not.toBe('23.08.2026, 13:39:51');
		expect(formatMoscowDay('2026-08-23T13:39:51.000Z')).toBe('23.08.2026');
		expect(formatMoscowDay(1787492391)).toBe('23.08.2026');
	});
});
