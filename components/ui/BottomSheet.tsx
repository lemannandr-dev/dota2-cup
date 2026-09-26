'use client';

import type { ReactNode, PointerEvent as ReactPointerEvent } from 'react';
import { useEffect, useId, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { hapticTap } from '@/lib/haptics';
import { sheetShouldDismiss } from '@/lib/pull-gestures';

type Props = {
	open: boolean;
	onClose: () => void;
	title: string;
	description?: string;
	children: ReactNode;
	footer?: ReactNode;
};

const FOCUSABLE =
	'a[href], button:not([disabled]), textarea, input, select, [tabindex]:not([tabindex="-1"])';

export function BottomSheet({ open, onClose, title, description, children, footer }: Props) {
	const titleId = useId();
	const descriptionId = useId();
	const panelRef = useRef<HTMLElement>(null);
	const closeRef = useRef<HTMLButtonElement>(null);
	const onCloseRef = useRef(onClose);
	const dragStartY = useRef<number | null>(null);
	const lastMove = useRef<{ y: number; t: number } | null>(null);
	const [dragY, setDragY] = useState(0);

	useEffect(() => {
		onCloseRef.current = onClose;
	}, [onClose]);

	useEffect(() => {
		if (!open) return;
		const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
		const previousOverflow = document.body.style.overflow;
		document.body.style.overflow = 'hidden';
		closeRef.current?.focus();
		setDragY(0);
		hapticTap(8);

		function onKeyDown(event: KeyboardEvent) {
			if (event.key === 'Escape') {
				onCloseRef.current();
				return;
			}
			if (event.key !== 'Tab' || !panelRef.current) return;
			const nodes = Array.from(panelRef.current.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
				(node) => !node.hasAttribute('disabled') && node.getAttribute('aria-hidden') !== 'true'
			);
			if (nodes.length === 0) return;
			const first = nodes[0];
			const last = nodes[nodes.length - 1];
			const active = document.activeElement;
			if (event.shiftKey && active === first) {
				event.preventDefault();
				last.focus();
			} else if (!event.shiftKey && active === last) {
				event.preventDefault();
				first.focus();
			}
		}

		document.addEventListener('keydown', onKeyDown);
		return () => {
			document.body.style.overflow = previousOverflow;
			document.removeEventListener('keydown', onKeyDown);
			previousFocus?.focus();
		};
	}, [open]);

	function onHandlePointerDown(event: ReactPointerEvent<HTMLElement>) {
		dragStartY.current = event.clientY;
		lastMove.current = { y: event.clientY, t: performance.now() };
		event.currentTarget.setPointerCapture(event.pointerId);
	}

	function onHandlePointerMove(event: ReactPointerEvent<HTMLElement>) {
		if (dragStartY.current == null) return;
		const delta = Math.max(0, event.clientY - dragStartY.current);
		lastMove.current = { y: event.clientY, t: performance.now() };
		setDragY(delta);
	}

	function onHandlePointerUp(event: ReactPointerEvent<HTMLElement>) {
		if (dragStartY.current == null) return;
		const startY = dragStartY.current;
		const delta = Math.max(0, event.clientY - startY);
		const last = lastMove.current;
		const dt = last ? Math.max(1, performance.now() - last.t) : 1;
		// Instantaneous velocity from the last sample → release (px/ms).
		const velocity = last ? Math.max(0, (event.clientY - last.y) / dt) : 0;
		dragStartY.current = null;
		lastMove.current = null;
		const height = panelRef.current?.getBoundingClientRect().height ?? 480;
		if (sheetShouldDismiss({ deltaY: delta, velocity, panelHeight: height })) {
			setDragY(0);
			onClose();
			return;
		}
		setDragY(0);
	}

	if (!open) return null;

	return createPortal(
		<div className="fixed inset-0 z-[70] flex items-end justify-center md:items-center md:p-6">
			<button
				type="button"
				aria-label="Закрыть окно"
				onClick={onClose}
				className="absolute inset-0 cursor-default bg-black/75 backdrop-blur-sm animate-[modalFade_180ms_ease-out]"
			/>
			<section
				ref={panelRef}
				role="dialog"
				aria-modal="true"
				aria-labelledby={titleId}
				aria-describedby={description ? descriptionId : undefined}
				data-no-pull="1"
				className="relative flex max-h-[88dvh] w-full flex-col overflow-hidden rounded-t-lg border border-line bg-panel shadow-2xl animate-[modalRise_260ms_ease-out] md:max-w-xl md:rounded-lg"
				style={dragY ? { transform: `translateY(${dragY}px)`, transition: dragStartY.current ? 'none' : undefined } : undefined}
			>
				<div
					className="mx-auto mt-2 flex w-full cursor-grab touch-none flex-col items-center py-2 active:cursor-grabbing md:hidden"
					onPointerDown={onHandlePointerDown}
					onPointerMove={onHandlePointerMove}
					onPointerUp={onHandlePointerUp}
					onPointerCancel={onHandlePointerUp}
					aria-hidden="true"
				>
					<span className="h-1 w-10 rounded-full bg-white/25" />
				</div>
				<header
					className="flex cursor-grab touch-none items-start justify-between gap-4 border-b border-line/70 px-4 py-4 active:cursor-grabbing sm:px-5 md:cursor-default md:touch-auto"
					onPointerDown={(event) => {
						if (window.matchMedia('(min-width: 768px)').matches) return;
						if ((event.target as HTMLElement).closest('button')) return;
						onHandlePointerDown(event);
					}}
					onPointerMove={onHandlePointerMove}
					onPointerUp={onHandlePointerUp}
					onPointerCancel={onHandlePointerUp}
				>
					<div className="min-w-0">
						<h2 id={titleId} className="font-display text-lg text-cream">
							{title}
						</h2>
						{description ? (
							<p id={descriptionId} className="mt-1 text-sm leading-5 text-muted">
								{description}
							</p>
						) : null}
					</div>
					<button
						ref={closeRef}
						type="button"
						onClick={onClose}
						aria-label="Закрыть"
						className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border border-line text-muted transition-colors hover:border-aegis/60 hover:text-cream"
					>
						<X className="h-5 w-5" aria-hidden="true" />
					</button>
				</header>
				<div className="overflow-y-auto px-4 py-4 sm:px-5">{children}</div>
				{footer ? <footer className="border-t border-line/70 px-4 py-3 sm:px-5">{footer}</footer> : null}
			</section>
		</div>,
		document.body
	);
}
