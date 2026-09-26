'use client';

import React, { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Bell, X } from 'lucide-react';

type NotificationItem = {
	id: string;
	type: string;
	title: string;
	body: string;
	linkUrl: string | null;
	readAt: string | null;
	metadata?: { challengeId?: string; inviteId?: string } | null;
	createdAt: string;
};

export function NotificationBell() {
	const router = useRouter();
	const [open, setOpen] = useState(false);
	const [items, setItems] = useState<NotificationItem[]>([]);
	const [unreadCount, setUnreadCount] = useState(0);
	const panelRef = useRef<HTMLDivElement>(null);
	const toggleRef = useRef<HTMLButtonElement>(null);

	async function load() {
		const res = await fetch('/api/notifications', { cache: 'no-store' });
		if (!res.ok) return;
		const data = await res.json();
		const nextUnread = data.unreadCount ?? 0;
		setItems(data.notifications ?? []);
		setUnreadCount(nextUnread);
		try {
			if ('setAppBadge' in navigator) {
				if (nextUnread > 0) await (navigator as Navigator & { setAppBadge: (n: number) => Promise<void> }).setAppBadge(nextUnread);
				else if ('clearAppBadge' in navigator) await (navigator as Navigator & { clearAppBadge: () => Promise<void> }).clearAppBadge();
			}
		} catch {
			/* badge is best-effort on PWA */
		}
	}

	useEffect(() => {
		const refresh = () => { void load().catch(() => undefined); };
		refresh();
		const timer = window.setInterval(refresh, 30000);
		return () => window.clearInterval(timer);
	}, []);

	useEffect(() => {
		if (!open) return;
		function keydown(event: KeyboardEvent) {
			if (event.key === 'Escape') { setOpen(false); toggleRef.current?.focus(); }
		}
		function outside(event: PointerEvent) {
			if (!panelRef.current?.contains(event.target as Node)) setOpen(false);
		}
		document.addEventListener('keydown', keydown);
		document.addEventListener('pointerdown', outside);
		return () => { document.removeEventListener('keydown', keydown); document.removeEventListener('pointerdown', outside); };
	}, [open]);

	async function markAllRead() {
		await fetch('/api/notifications', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({}) });
		await load();
	}

	async function markRead(id: string) {
		await fetch('/api/notifications', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id }) });
	}

	function hrefFor(item: NotificationItem) {
		if (item.metadata?.inviteId) return `/party-search?invite=${encodeURIComponent(item.metadata.inviteId)}`;
		if (item.metadata?.challengeId) return `/teams?challenge=${item.metadata.challengeId}`;
		return item.linkUrl ?? '#';
	}

	return (
		<div ref={panelRef} className="md:relative">
			<button ref={toggleRef} type="button" aria-label={`Уведомления: ${unreadCount}`} aria-expanded={open} title="Уведомления" onClick={() => setOpen((value) => !value)} className="relative inline-flex h-11 w-11 items-center justify-center rounded-lg border border-line bg-panel2 text-cream transition hover:border-aegis">
				<Bell size={19} aria-hidden="true" />
				{unreadCount > 0 && <span aria-hidden="true" className="absolute -right-1 -top-1 min-w-4 rounded-full bg-aegis px-1 text-center font-mono text-[10px] text-ink">{unreadCount > 99 ? '99+' : unreadCount}</span>}
			</button>

			{open && (
				<div role="region" aria-label="Уведомления" className="absolute inset-x-3 top-full z-50 max-h-[calc(100dvh-9rem-env(safe-area-inset-top)-env(safe-area-inset-bottom))] overflow-y-auto overscroll-contain rounded-lg border border-line bg-ink p-3 shadow-2xl md:inset-x-auto md:right-0 md:top-12 md:w-80">
					<div className="mb-2 flex items-center justify-between gap-3">
						<div className="font-display text-sm text-cream">Уведомления</div>
						<button type="button" onClick={() => { void markAllRead().catch(() => undefined); }} className="min-h-11 text-xs text-muted hover:text-cream">Прочитать все</button>
						<button type="button" aria-label="Закрыть уведомления" onClick={() => setOpen(false)} className="inline-flex h-11 w-11 shrink-0 items-center justify-center text-muted"><X size={18} aria-hidden="true" /></button>
					</div>
					{items.length === 0 ? (
						<div className="rounded-lg bg-panel/70 p-3 text-sm text-muted">Пока нет уведомлений.</div>
					) : (
						<div className="max-h-96 space-y-2 overflow-y-auto">
							{items.map((item) => (
								<button key={item.id} type="button" onClick={() => { void markRead(item.id).catch(() => undefined); setOpen(false); router.push(hrefFor(item)); }} className="block w-full break-words rounded-lg border border-line/70 bg-panel/70 p-3 text-left hover:border-aegis/50">
									<div className="flex items-center justify-between gap-3">
										<div className="text-sm font-semibold text-cream">{item.title}</div>
										{!item.readAt && <span className="h-2 w-2 rounded-full bg-aegis" aria-label="Новое" />}
									</div>
									<div className="mt-1 text-xs leading-5 text-muted">{item.body}</div>
								</button>
							))}
						</div>
					)}
				</div>
			)}
		</div>
	);
}
