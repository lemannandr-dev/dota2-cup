import { describe, expect, it } from 'vitest';
import { generateTotpSecret, totpAuthUrl, totpCode, verifyTotp } from '@/lib/totp';

describe('totp', () => {
	it('accepts the current window and rejects a bad code', () => {
		const secret = generateTotpSecret();
		const now = Date.parse('2026-08-24T15:00:00.000Z');
		expect(verifyTotp(secret, totpCode(secret, now), now)).toBe(true);
		expect(verifyTotp(secret, '000000', now)).toBe(false);
		expect(totpAuthUrl(secret, 'Org')).toContain('otpauth://totp/');
	});
});
