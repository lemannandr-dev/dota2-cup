export function prizeRequiresTotp(prizePool: number) {
	return prizePool > 0;
}

export function payoutTotpGate(input: {
	prizePool: number;
	totpEnabled: boolean;
	codeValid: boolean;
	action: 'reserve' | 'confirm';
}): { ok: true } | { ok: false; error: string } {
	if (!prizeRequiresTotp(input.prizePool)) return { ok: true };
	if (!input.totpEnabled) {
		return { ok: false, error: 'Для живого приза включите ключ выплаты в профиле' };
	}
	if (!input.codeValid) {
		return { ok: false, error: 'Нужен код из приложения-ключа' };
	}
	return { ok: true };
}

export function cupDryRunLines(prizePool: number) {
	if (prizePool <= 0) return [];
	return [
		'Две команды проходят чек-ин и сетку на стенде',
		'Капитаны сдают один и тот же счёт',
		'Ключ выплаты включён, фонд на эскроу, тестовая выплата прошла'
	];
}
