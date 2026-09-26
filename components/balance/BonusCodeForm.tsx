'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { formatPrizeAmount } from '@/lib/prize-places';

export default function BonusCodeForm() {
	const router = useRouter();
	const [code, setCode] = useState('');
	const [msg, setMsg] = useState<string | null>(null);
	const [error, setError] = useState<string | null>(null);
	const [busy, setBusy] = useState(false);

	async function submit(event: React.FormEvent) {
		event.preventDefault();
		setBusy(true);
		setMsg(null);
		setError(null);
		try {
			const res = await fetch('/api/bonus-codes/use', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ code })
			});
			const data = await res.json().catch(() => null);
			if (!res.ok) {
				setError(data?.error || 'Код не подошёл');
				return;
			}
			setMsg(`Зачислено ${formatPrizeAmount(data.amount ?? 0)}`);
			setCode('');
			router.refresh();
		} catch {
			setError('Сеть оборвалась. Код не списывали повторно — попробуйте ещё раз.');
		} finally {
			setBusy(false);
		}
	}

	return (
		<form onSubmit={(event) => void submit(event)} className="space-y-3">
			<label className="block text-sm text-cream">
				Промокод
				<input
					value={code}
					onChange={(event) => setCode(event.target.value.toUpperCase())}
					maxLength={32}
					autoComplete="off"
					spellCheck={false}
					placeholder="например AEGIS-WEEKEND"
					className="mt-1 w-full rounded-lg border border-line bg-panel px-3 py-2 font-mono text-sm uppercase tracking-wide text-cream outline-none focus:border-aegis"
				/>
			</label>
			<button
				type="submit"
				disabled={busy || code.trim().length < 4}
				className="inline-flex min-h-11 items-center rounded-full bg-aegis px-5 text-sm font-semibold text-ink disabled:opacity-50"
			>
				{busy ? 'Проверяем…' : 'Активировать'}
			</button>
			{msg && <p className="text-sm text-radiant">{msg}</p>}
			{error && <p className="text-sm text-red-200">{error}</p>}
			<p className="text-xs leading-5 text-muted">Один код — один раз на аккаунт. Неверный код не списывает баланс.</p>
		</form>
	);
}
