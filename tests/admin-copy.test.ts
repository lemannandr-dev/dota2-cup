import { describe, expect, it } from 'vitest';
import {
	adminAuditLabel,
	adminPrizeStatusLabel,
	adminRoleLabel,
	adminTxTypeLabel
} from '@/lib/admin-copy';
import { tournamentStatusLabel } from '@/lib/tournament-copy';

describe('admin russian copy', () => {
	it('translates roles, statuses, ledger and audit keys', () => {
		expect(adminRoleLabel('ADMIN')).toBe('Админ стенда');
		expect(adminRoleLabel('ORGANIZER')).toBe('Организатор');
		expect(adminPrizeStatusLabel('UNCONFIRMED')).toBe('не зарезервирован');
		expect(adminTxTypeLabel('SPENT')).toBe('эскроу');
		expect(adminAuditLabel('STAND_ADMIN_GRANTED')).toBe('Выдан доступ в админку стенда');
		expect(adminAuditLabel('PRIZE_PAID')).toBe('Приз выплачен капитану');
		expect(adminAuditLabel('TOTP_RESET')).toBe('Сброшен ключ выплаты');
		expect(tournamentStatusLabel('REGISTRATION')).toBe('Регистрация');
		expect(tournamentStatusLabel('CHECK_IN')).toBe('Отметка состава');
	});
});
