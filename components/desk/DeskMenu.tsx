'use client';

import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';

export type DeskMenuItem = {
	id: string;
	label: string;
	hint?: string;
	href?: string;
	onSelect?: () => void;
};

export function DeskMenu({
	title,
	x,
	y,
	items,
	menuId
}: {
	title: string;
	x: number;
	y: number;
	items: DeskMenuItem[];
	menuId: string;
}) {
	const [mounted, setMounted] = useState(false);
	useEffect(() => setMounted(true), []);

	const node = (
		<div
			id={menuId}
			className="desk-menu-popover fixed z-[80] max-h-[min(16.5rem,62vh)] w-56 overflow-y-auto rounded-lg border border-line bg-ink/96 p-0.5 shadow-2xl"
			style={{ left: x, top: y }}
			onContextMenu={(event) => event.preventDefault()}
		>
			<div className="truncate px-2 py-1 text-[10px] uppercase tracking-[0.12em] text-muted">{title}</div>
			{items.map((item) =>
				item.href ? (
					<a key={item.id} href={item.href} className="flex w-full flex-col items-start rounded-md px-2 py-1 text-left hover:bg-aegis/10">
						<span className="w-full truncate text-[13px] leading-4 text-cream">{item.label}</span>
						{item.hint && <span className="w-full truncate text-[10px] leading-3 text-muted">{item.hint}</span>}
					</a>
				) : (
					<button key={item.id} type="button" onClick={item.onSelect} className="flex w-full flex-col items-start rounded-md px-2 py-1 text-left hover:bg-aegis/10">
						<span className="w-full truncate text-[13px] leading-4 text-cream">{item.label}</span>
						{item.hint && <span className="w-full truncate text-[10px] leading-3 text-muted">{item.hint}</span>}
					</button>
				)
			)}
		</div>
	);

	if (!mounted) return null;
	return createPortal(node, document.body);
}

export function clampMenu(x: number, y: number, width = 224, height = 264) {
	if (typeof window === 'undefined') return { x, y };
	return {
		x: Math.max(8, Math.min(x, window.innerWidth - width - 8)),
		y: Math.max(8, Math.min(y, window.innerHeight - height - 8))
	};
}

export function bindDeskMenuClose(close: () => void, keepSelector: string) {
	function onKey(event: KeyboardEvent) {
		if (event.key === 'Escape') close();
	}
	function onPointerDown(event: PointerEvent) {
		const node = event.target as HTMLElement | null;
		if (node?.closest(keepSelector)) return;
		close();
	}
	function onMove(event: Event) {
		const node = event.target as HTMLElement | null;
		if (node?.closest(keepSelector)) return;
		close();
	}
	const timer = window.setTimeout(() => {
		window.addEventListener('pointerdown', onPointerDown);
	}, 0);
	window.addEventListener('keydown', onKey);
	window.addEventListener('scroll', onMove, true);
	window.addEventListener('wheel', onMove, { passive: true, capture: true });
	return () => {
		window.clearTimeout(timer);
		window.removeEventListener('pointerdown', onPointerDown);
		window.removeEventListener('keydown', onKey);
		window.removeEventListener('scroll', onMove, true);
		window.removeEventListener('wheel', onMove, true);
	};
}
