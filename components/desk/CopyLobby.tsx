'use client';

import { useState } from 'react';
import { Check, Copy } from 'lucide-react';
import { lobbyCopyText } from '@/lib/match-lobby';
import { useToast } from '@/components/ui/ToastProvider';
import { haptic } from '@/lib/haptics';

export function CopyLobbyButton({
	name,
	password,
	region,
	voiceUrl
}: {
	name: string;
	password?: string | null;
	region?: string | null;
	voiceUrl?: string | null;
}) {
	const [copied, setCopied] = useState(false);
	const { showToast } = useToast();

	async function copy() {
		try {
			await navigator.clipboard.writeText(lobbyCopyText({ name, password, region, voiceUrl }));
			setCopied(true);
			haptic('success');
			showToast('Данные лобби скопированы');
			window.setTimeout(() => setCopied(false), 2000);
		} catch {
			setCopied(false);
			showToast('Не удалось скопировать данные лобби', 'error');
		}
	}

	return (
		<button
			type="button"
			onClick={() => void copy()}
			className={`inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border border-line px-3 text-sm text-aegisSoft transition-colors hover:border-aegis hover:text-aegis ${copied ? 'copy-lobby-pulse border-aegis/60' : ''}`}
		>
			{copied ? <Check className="h-4 w-4" aria-hidden="true" /> : <Copy className="h-4 w-4" aria-hidden="true" />}
			<span aria-live="polite">{copied ? 'Скопировано' : 'Скопировать лобби'}</span>
		</button>
	);
}
