'use client';

import { useEffect, useState } from 'react';

const DISMISS_KEY = 'aegis.pushOptIn.dismissed';

function urlBase64ToUint8Array(base64String: string) {
	const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
	const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
	const raw = window.atob(base64);
	const output = new Uint8Array(raw.length);
	for (let i = 0; i < raw.length; i += 1) output[i] = raw.charCodeAt(i);
	return output;
}

function mapPushError(err: unknown): string {
	const message = err instanceof Error ? err.message : String(err ?? '');
	if (/push service not available/i.test(message)) {
		return 'Пуш-сервис браузера недоступен (часто на HTTP или без Google-сервисов). Колокольчик на сайте работает.';
	}
	if (/registration failed/i.test(message)) {
		return 'Не удалось зарегистрировать пуш. На HTTPS-стенде обычно работает; локально можно пропустить.';
	}
	if (/permission/i.test(message)) return 'Разрешение на уведомления не выдано.';
	if (/vapid|ключ/i.test(message)) return 'Нет VAPID-ключа на сервере.';
	return message || 'Ошибка подписки';
}

function pushLikelyUnavailable() {
	if (typeof window === 'undefined') return true;
	if (!('Notification' in window) || !('serviceWorker' in navigator) || !('PushManager' in window)) return true;
	// Non-secure origins (except localhost) cannot use Web Push reliably.
	if (!window.isSecureContext && window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1') {
		return true;
	}
	return false;
}

export function PushOptIn() {
	const [state, setState] = useState<'hidden' | 'ask' | 'on' | 'off' | 'unsupported'>('hidden');
	const [busy, setBusy] = useState(false);
	const [error, setError] = useState<string | null>(null);

	useEffect(() => {
		if (typeof window === 'undefined') return;
		if (window.localStorage.getItem(DISMISS_KEY) === '1') {
			setState('hidden');
			return;
		}
		if (pushLikelyUnavailable()) {
			setState('unsupported');
			return;
		}
		void (async () => {
			const meta = await fetch('/api/push/subscribe', { cache: 'no-store' })
				.then((res) => (res.ok ? res.json() : null))
				.catch(() => null);
			if (!meta?.configured || !meta.publicKey) {
				setState('hidden');
				return;
			}
			if (Notification.permission === 'granted' && meta.subscriptions > 0) setState('on');
			else if (Notification.permission === 'denied') setState('off');
			else setState('ask');
		})();
	}, []);

	function dismiss() {
		try {
			window.localStorage.setItem(DISMISS_KEY, '1');
		} catch {
			/* ignore quota */
		}
		setState('hidden');
		setError(null);
	}

	async function enable() {
		setBusy(true);
		setError(null);
		try {
			if (pushLikelyUnavailable() || !('PushManager' in window)) {
				setState('unsupported');
				setError('Пуш-сервис браузера недоступен (часто на HTTP или без Google-сервисов). Колокольчик на сайте работает.');
				return;
			}
			const meta = await fetch('/api/push/subscribe', { cache: 'no-store' }).then((res) => res.json());
			if (!meta?.publicKey) throw new Error('Нет VAPID ключа');
			const permission = await Notification.requestPermission();
			if (permission !== 'granted') {
				setState('off');
				return;
			}
			const registration = await navigator.serviceWorker.ready;
			if (!registration.pushManager) {
				throw new Error('Registration failed - push service not available');
			}
			let subscription: PushSubscription;
			try {
				subscription = await registration.pushManager.subscribe({
					userVisibleOnly: true,
					applicationServerKey: urlBase64ToUint8Array(meta.publicKey)
				});
			} catch (subscribeErr) {
				throw subscribeErr instanceof Error
					? subscribeErr
					: new Error('Registration failed - push service not available');
			}
			const json = subscription.toJSON();
			const response = await fetch('/api/push/subscribe', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				credentials: 'same-origin',
				body: JSON.stringify({ endpoint: json.endpoint, keys: json.keys })
			});
			const body = await response.json().catch(() => null);
			if (!response.ok) throw new Error(body?.error || 'Не удалось сохранить подписку');
			setState('on');
		} catch (err) {
			const friendly = mapPushError(err);
			setError(friendly);
			if (/недоступен|не удалось зарегистрировать|VAPID/i.test(friendly)) {
				setState('unsupported');
			}
		} finally {
			setBusy(false);
		}
	}

	if (state === 'hidden' || state === 'on') return null;

	if (state === 'unsupported') {
		return (
			<div className="fixed bottom-[calc(4.5rem+env(safe-area-inset-bottom))] right-3 z-30 max-w-xs rounded-lg border border-line bg-ink/95 p-3 text-sm shadow-lg md:bottom-4">
				<p className="text-cream">Пуш в этом браузере недоступен</p>
				<p className="mt-1 text-xs text-muted">
					Колокольчик на сайте останется. Web Push обычно нужен HTTPS и push-сервис браузера.
				</p>
				{error ? <p className="mt-1 text-xs text-muted">{error}</p> : null}
				<button
					type="button"
					onClick={dismiss}
					className="mt-2 inline-flex min-h-11 w-full items-center justify-center rounded-lg border border-line px-3 text-sm text-cream hover:border-aegis/50"
				>
					Понятно
				</button>
			</div>
		);
	}

	return (
		<div className="fixed bottom-[calc(4.5rem+env(safe-area-inset-bottom))] right-3 z-30 max-w-xs rounded-lg border border-aegis/40 bg-ink/95 p-3 text-sm shadow-lg md:bottom-4">
			<p className="text-cream">Пуш о чек-ине и готовности</p>
			<p className="mt-1 text-xs text-muted">Колокольчик на сайте останется. Пуш — только если разрешите в браузере.</p>
			{error && <p className="mt-1 text-xs text-red-200">{error}</p>}
			<div className="mt-2 flex gap-2">
				<button
					type="button"
					disabled={busy || state === 'off'}
					onClick={() => void enable()}
					className="inline-flex min-h-11 flex-1 items-center justify-center rounded-lg bg-aegis px-3 text-sm font-semibold text-ink disabled:opacity-50"
				>
					{state === 'off' ? 'Разрешение отклонено' : busy ? 'Подключаем…' : 'Включить пуш'}
				</button>
				<button
					type="button"
					onClick={dismiss}
					className="inline-flex min-h-11 items-center justify-center rounded-lg border border-line px-3 text-xs text-muted hover:text-cream"
				>
					Позже
				</button>
			</div>
		</div>
	);
}
