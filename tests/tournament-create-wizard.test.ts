import { describe, expect, it } from 'vitest';
import {
	escrowPayoutStrip,
	nextTournamentCreateStep,
	parseTournamentCreateDraft,
	previewCreatePrize,
	validateTournamentCreateStep
} from '@/lib/tournament-create-wizard';

describe('tournament create wizard', () => {
	it('validates basics and schedule', () => {
		expect(validateTournamentCreateStep('basics', { title: 'ab', startAt: '', prizePool: '0', seriesRules: 'BO1' })).toMatch(/3/);
		expect(validateTournamentCreateStep('basics', { title: 'Weekend', startAt: '', prizePool: '0', seriesRules: 'BO1' })).toBeNull();
		expect(validateTournamentCreateStep('schedule', { title: 'Weekend', startAt: '', prizePool: '0', seriesRules: 'BO1' })).toMatch(/старта/i);
		expect(
			validateTournamentCreateStep('schedule', {
				title: 'Weekend',
				startAt: '2026-09-20T18:00',
				prizePool: '0',
				seriesRules: 'BO1'
			})
		).toBeNull();
	});

	it('walks steps and restores a draft payload', () => {
		expect(nextTournamentCreateStep('basics')).toBe('schedule');
		expect(nextTournamentCreateStep('review')).toBeNull();
		const parsed = parseTournamentCreateDraft({
			title: 'Clash',
			format: 'DOUBLE_ELIMINATION',
			maxTeams: '16',
			step: 'prize',
			prizePool: '15000',
			savedAt: '2026-09-19T10:00:00.000Z'
		});
		expect(parsed?.title).toBe('Clash');
		expect(parsed?.step).toBe('prize');
		expect(parsed?.maxTeams).toBe('16');
	});

	it('previews 70/30 split and wallet shortfall', () => {
		const preview = previewCreatePrize(10_000, 500_000);
		expect(preview.opensAsDraft).toBe(true);
		expect(preview.lines).toHaveLength(2);
		expect(preview.wallet.shortfall).toBe(500_000);
		expect(preview.hint).toMatch(/не хватает/i);
	});

	it('builds a mobile escrow strip', () => {
		const strip = escrowPayoutStrip({
			totalLabel: '10 000 ₽',
			escrowReady: false,
			canReserve: true,
			canPay: false,
			alreadyPaid: false,
			wallet: {
				haveLabel: '0 ₽',
				neededLabel: '10 000 ₽',
				shortfall: 1_000_000,
				shortfallLabel: '10 000 ₽',
				canAfford: false
			},
			hint: 'Пополните баланс'
		});
		expect(strip.tone).toBe('warn');
		expect(strip.status).toMatch(/Не хватает/);
	});
});
