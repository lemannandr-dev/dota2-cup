'use client';

import { useEffect, useState } from 'react';
import { listOfflineQueue, replayOfflineQueue } from '@/lib/offline-queue';
import { useToast } from '@/components/ui/ToastProvider';

export function OfflineQueueProvider({ children }: { children: React.ReactNode }) {
	const { showToast } = useToast();
	const [pending, setPending] = useState(0);

	useEffect(() => {
		function syncCount() {
			setPending(listOfflineQueue().length);
		}

		async function flush() {
			if (typeof navigator !== 'undefined' && !navigator.onLine) {
				syncCount();
				return;
			}
			const queued = listOfflineQueue();
			if (queued.length === 0) {
				setPending(0);
				return;
			}
			const result = await replayOfflineQueue();
			syncCount();
			if (result.ok > 0) showToast(`Отправлено из очереди: ${result.ok}`, 'success');
			if (result.fail > 0) showToast(result.errors[0] || `Не удалось: ${result.fail}`, 'error');
		}

		function onOnline() {
			void flush();
		}

		function onStorage() {
			syncCount();
		}

		window.addEventListener('online', onOnline);
		window.addEventListener('storage', onStorage);
		syncCount();
		void flush();
		const timer = window.setInterval(syncCount, 4000);
		return () => {
			window.removeEventListener('online', onOnline);
			window.removeEventListener('storage', onStorage);
			window.clearInterval(timer);
		};
	}, [showToast]);

	return (
		<>
			{children}
			{pending > 0 ? (
				<div
					className="pointer-events-none fixed left-3 top-[calc(4.5rem+env(safe-area-inset-top))] z-40 md:left-auto md:right-4"
					role="status"
					aria-live="polite"
				>
					<span className="inline-flex items-center rounded-md border border-info/40 bg-ink/95 px-2.5 py-1 text-[11px] text-info shadow-lg backdrop-blur">
						Офлайн-очередь · {pending}
					</span>
				</div>
			) : null}
		</>
	);
}
