'use client';

import { useEffect, useRef, useState } from 'react';
import { Download, Share, SquarePlus } from 'lucide-react';
import { BottomSheet } from '@/components/ui/BottomSheet';
import { useToast } from '@/components/ui/ToastProvider';
import { isIosDevice, isStandaloneDisplay } from '@/lib/pwa-install';

type InstallPromptEvent = Event & {
	prompt: () => Promise<void>;
	userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
};

export function PwaInstallControl() {
	const { showToast } = useToast();
	const promptRef = useRef<InstallPromptEvent | null>(null);
	const [available, setAvailable] = useState(false);
	const [isIos, setIsIos] = useState(false);
	const [sheetOpen, setSheetOpen] = useState(false);

	useEffect(() => {
		const nav = navigator as Navigator & { standalone?: boolean };
		const standalone = isStandaloneDisplay(window.matchMedia('(display-mode: standalone)').matches, Boolean(nav.standalone));
		if (standalone) return;

		const ios = isIosDevice(nav.userAgent, nav.platform, nav.maxTouchPoints);
		setIsIos(ios);
		if (ios) setAvailable(true);

		function onBeforeInstall(event: Event) {
			event.preventDefault();
			promptRef.current = event as InstallPromptEvent;
			setAvailable(true);
		}

		function onInstalled() {
			promptRef.current = null;
			setAvailable(false);
			setSheetOpen(false);
			showToast('Aegis Arena установлена');
		}

		window.addEventListener('beforeinstallprompt', onBeforeInstall);
		window.addEventListener('appinstalled', onInstalled);
		return () => {
			window.removeEventListener('beforeinstallprompt', onBeforeInstall);
			window.removeEventListener('appinstalled', onInstalled);
		};
	}, [showToast]);

	async function install() {
		if (isIos || !promptRef.current) {
			setSheetOpen(true);
			return;
		}

		const prompt = promptRef.current;
		await prompt.prompt();
		const choice = await prompt.userChoice;
		if (choice.outcome === 'accepted') {
			promptRef.current = null;
			setAvailable(false);
		} else {
			showToast('Установка отменена', 'info');
		}
	}

	if (!available) return null;

	return (
		<>
			<button
				type="button"
				onClick={() => void install()}
				aria-label="Установить Aegis Arena"
				title="Установить приложение"
				className="inline-flex h-11 w-11 items-center justify-center rounded-lg border border-line text-muted transition-colors hover:border-aegis/60 hover:text-aegisSoft"
			>
				<Download className="h-5 w-5" aria-hidden="true" />
			</button>
			<BottomSheet
				open={sheetOpen}
				onClose={() => setSheetOpen(false)}
				title="Установить Aegis Arena"
				description="На iPhone установка выполняется через меню Safari."
				footer={
					<button type="button" onClick={() => setSheetOpen(false)} className="min-h-12 w-full rounded-lg bg-aegis px-4 text-sm font-semibold text-ink">
						Понятно
					</button>
				}
			>
				<ol className="space-y-3">
					<li className="flex items-center gap-3 rounded-lg border border-line/70 bg-black/20 p-3">
						<span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-panel2 text-aegisSoft"><Share className="h-5 w-5" aria-hidden="true" /></span>
						<span className="text-sm text-cream">Нажмите «Поделиться» в панели Safari.</span>
					</li>
					<li className="flex items-center gap-3 rounded-lg border border-line/70 bg-black/20 p-3">
						<span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-panel2 text-aegisSoft"><SquarePlus className="h-5 w-5" aria-hidden="true" /></span>
						<span className="text-sm text-cream">Выберите «На экран Домой» и подтвердите добавление.</span>
					</li>
				</ol>
			</BottomSheet>
		</>
	);
}
