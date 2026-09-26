'use client';

import { useEffect, useState } from 'react';
import { referralShareUrl } from '@/lib/referrals';

async function copyText(value: string) {
	try {
		await navigator.clipboard.writeText(value);
		return true;
	} catch {
		const input = document.createElement('textarea');
		input.value = value;
		input.setAttribute('readonly', '');
		input.style.position = 'fixed';
		input.style.left = '-9999px';
		document.body.appendChild(input);
		input.select();
		const copied = document.execCommand('copy');
		input.remove();
		return copied;
	}
}

export function ReferralShareButton({ className = '' }: { className?: string }) {
	const [status, setStatus] = useState('');
	const [code, setCode] = useState<string | null>(null);

	useEffect(() => {
		let cancelled = false;
		void fetch('/api/referrals/me', { cache: 'no-store' })
			.then(async (response) => {
				if (!response.ok) return null;
				const body = (await response.json()) as { code?: string };
				return body.code ?? null;
			})
			.then((next) => {
				if (!cancelled && next) setCode(next);
			})
			.catch(() => undefined);
		return () => {
			cancelled = true;
		};
	}, []);

	async function share() {
		setStatus('');
		try {
			let nextCode = code;
			if (!nextCode) {
				const response = await fetch('/api/referrals/me', { cache: 'no-store' });
				const body = (await response.json()) as { code?: string; error?: string };
				if (!response.ok || !body.code) {
					setStatus(body.error || 'Ссылка не собралась');
					return;
				}
				nextCode = body.code;
				setCode(nextCode);
			}
			const url = referralShareUrl(window.location.origin, nextCode);
			const copied = await copyText(url);
			setStatus(copied ? 'Ссылка скопирована' : url);
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
			{status ? <span className="max-w-[14rem] truncate text-[10px] text-[#F5C451]">{status}</span> : null}
		</span>
	);
}
