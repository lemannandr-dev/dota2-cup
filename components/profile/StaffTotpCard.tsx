'use client';

import React, { useEffect, useState } from 'react';

export function StaffTotpCard() {
	const [enabled, setEnabled] = useState(false);
	const [secret, setSecret] = useState<string | null>(null);
	const [otpauth, setOtpauth] = useState<string | null>(null);
	const [code, setCode] = useState('');
	const [status, setStatus] = useState<string | null>(null);

	useEffect(() => {
		void fetch('/api/account/totp', { cache: 'no-store' })
			.then((res) => (res.ok ? res.json() : null))
			.then((data) => {
				if (data?.enabled) setEnabled(true);
			})
			.catch(() => undefined);
	}, []);

	async function start() {
		setStatus('Создаём секрет...');
		const res = await fetch('/api/account/totp', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ action: 'start' })
		});
		const data = await res.json().catch(() => null);
		if (!res.ok) {
			setStatus(data?.error ?? 'Не удалось начать.');
			return;
		}
		setSecret(data.secret);
		setOtpauth(data.otpauth);
		setStatus('Добавьте ключ в приложение и введите код.');
	}

	async function enable() {
		setStatus('Проверяем код...');
		const res = await fetch('/api/account/totp', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ action: 'enable', secret, code })
		});
		const data = await res.json().catch(() => null);
		if (!res.ok) {
			setStatus(data?.error ?? 'Код не подошёл.');
			return;
		}
		setEnabled(true);
		setSecret(null);
		setOtpauth(null);
		setCode('');
		setStatus('Ключ включён. Выплата призов потребует код из приложения.');
	}

	return (
		<section className="obsidian-glass rounded-card space-y-3 p-5">
			<div>
				<h2 className="font-display text-xl text-cream">Ключ выплаты</h2>
				<p className="mt-1 text-sm text-muted">
					TOTP для орга: Google Authenticator или похожее. Нужен перед живым призом. Пароль Steam сюда не вводится.
				</p>
			</div>
			{enabled ? (
				<p className="text-sm text-aegisSoft">Ключ включён. При выплате на карточке турнира спросите код из приложения.</p>
			) : (
				<div className="space-y-3">
					<button type="button" onClick={() => void start()} className="rounded-full border border-aegis/50 bg-aegis/10 px-4 py-2 text-sm font-semibold text-aegisSoft hover:border-aegis">
						Выпустить ключ
					</button>
					{secret && (
						<>
							<p className="break-all font-mono text-xs text-cream">{secret}</p>
							{otpauth && <p className="break-all text-[11px] text-muted">{otpauth}</p>}
							<input
								value={code}
								onChange={(event) => setCode(event.target.value)}
								maxLength={6}
								inputMode="numeric"
								placeholder="Код из приложения"
								className="w-40 rounded-lg border border-line bg-panel px-3 py-2 font-mono text-cream outline-none focus:border-aegis"
							/>
							<button type="button" onClick={() => void enable()} className="ml-2 rounded-full bg-aegis px-4 py-2 text-sm font-semibold text-ink">
								Включить
							</button>
						</>
					)}
				</div>
			)}
			{status && <p className="text-xs text-muted">{status}</p>}
		</section>
	);
}
