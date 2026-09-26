'use client';

import { useState } from 'react';

export function ReferralShareButton({ className = '' }: { className?: string }) {
	const [status, setStatus] = useState('');

	async function share() {
		setStatus('');
		try {
			const response = await fetch('/api/referrals/me', { cache: 'no-store' });
			const body = (await response.json()) as { url?: string; error?: string };
			if (!response.ok || !body.url) {
				setStatus(body.error || 'Ссылка не собралась');
				return;
			}
			const copied = await Promise.race([
				navigator.clipboard.writeText(body.url).then(() => true),
				new Promise<boolean>((resolve) => window.setTimeout(() => resolve(false), 700))
			]).catch(() => false);
			setStatus(copied ? 'Ссылка скопирована' : body.url);
			if (typeof navigator.share === 'function') {
				void navigator.share({ title: 'Aegis Arena', url: body.url }).catch(() => undefined);
			}
		} catch {
			setStatus('Не удалось скопировать');
		}
	}

	return (
		<span className={`inline-flex items-center gap-2 ${className}`}>
			<button
				type="button"
				onClick={() => void share()}
				className="inline-flex min-h-10 items-center rounded-md bg-[#F5C451] px-3 text-sm font-semibold text-[#1A1408] hover:bg-[#FFD56A]"
			>
				Пригласить
			</button>
			{status ? <span className="text-[10px] text-[#F5C451]">{status}</span> : null}
		</span>
	);
}
