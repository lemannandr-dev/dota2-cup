import { describe, expect, it } from 'vitest';
import { cupDryRunLines, payoutTotpGate, prizeRequiresTotp } from '@/lib/payout-totp';

describe('payout totp gate', () => {
	it('is optional when there is no prize', () => {
		expect(prizeRequiresTotp(0)).toBe(false);
		expect(payoutTotpGate({ prizePool: 0, totpEnabled: false, codeValid: false, action: 'confirm' }).ok).toBe(true);
		expect(cupDryRunLines(0)).toEqual([]);
	});

	it('requires an enabled key and a valid code before reserve or pay', () => {
		expect(
			payoutTotpGate({ prizePool: 10000, totpEnabled: false, codeValid: false, action: 'reserve' })
		).toEqual({ ok: false, error: 'Для живого приза включите ключ выплаты в профиле' });
		expect(
			payoutTotpGate({ prizePool: 10000, totpEnabled: true, codeValid: false, action: 'reserve' })
		).toEqual({ ok: false, error: 'Нужен код из приложения-ключа' });
		expect(payoutTotpGate({ prizePool: 10000, totpEnabled: true, codeValid: true, action: 'reserve' }).ok).toBe(true);
		expect(
			payoutTotpGate({ prizePool: 10000, totpEnabled: true, codeValid: false, action: 'confirm' })
		).toEqual({ ok: false, error: 'Нужен код из приложения-ключа' });
		expect(payoutTotpGate({ prizePool: 10000, totpEnabled: true, codeValid: true, action: 'confirm' }).ok).toBe(true);
	});

	it('lists the dry-run before a live prize', () => {
		expect(cupDryRunLines(5000)).toHaveLength(3);
	});
});
