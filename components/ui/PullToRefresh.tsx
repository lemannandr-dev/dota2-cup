'use client';

import type { ReactNode, TouchEvent as ReactTouchEvent } from 'react';
import { useRef, useState } from 'react';
import { RefreshCw } from 'lucide-react';
import { hapticTap } from '@/lib/haptics';
import {
	PULL_THRESHOLD_PX,
	pullDistance,
	pullShouldRefresh,
	shouldIgnorePullTarget
} from '@/lib/pull-gestures';

type Props = {
	onRefresh: () => void | Promise<void>;
	disabled?: boolean;
	children: ReactNode;
	className?: string;
	/** Accessible label for the manual refresh control. */
	label?: string;
};

/**
 * Mobile pull-to-refresh at scroll top. Critique vs package: no framer dependency;
 * fires after release past 72px; always exposes a button alternative.
 */
export function PullToRefresh({
	onRefresh,
	disabled = false,
	children,
	className = '',
	label = 'Обновить'
}: Props) {
	const rootRef = useRef<HTMLDivElement>(null);
	const startY = useRef<number | null>(null);
	const pulling = useRef(false);
	const [pull, setPull] = useState(0);
	const [busy, setBusy] = useState(false);

	async function runRefresh() {
		if (disabled || busy) return;
		setBusy(true);
		hapticTap(10);
		try {
			await onRefresh();
		} finally {
			setBusy(false);
			setPull(0);
			startY.current = null;
			pulling.current = false;
		}
	}

	function onTouchStart(event: ReactTouchEvent) {
		if (disabled || busy) return;
		if (shouldIgnorePullTarget(event.target)) return;
		const scroller = rootRef.current;
		if (!scroller) return;
		// Only when the page (or this container) is at the top.
		const pageAtTop = typeof window !== 'undefined' ? window.scrollY <= 2 : true;
		const selfAtTop = scroller.scrollTop <= 2;
		if (!pageAtTop || !selfAtTop) return;
		startY.current = event.touches[0]?.clientY ?? null;
		pulling.current = true;
	}

	function onTouchMove(event: ReactTouchEvent) {
		if (!pulling.current || startY.current == null || disabled || busy) return;
		const y = event.touches[0]?.clientY ?? startY.current;
		const delta = Math.max(0, y - startY.current);
		if (delta > 8) {
			setPull(pullDistance(delta));
		}
	}

	function onTouchEnd() {
		if (!pulling.current) return;
		const enough = pullShouldRefresh(pull);
		pulling.current = false;
		startY.current = null;
		if (enough) {
			void runRefresh();
			return;
		}
		setPull(0);
	}

	const progress = Math.min(1, pull / PULL_THRESHOLD_PX);

	return (
		<div
			ref={rootRef}
			className={`relative ${className}`}
			data-pull-to-refresh="1"
			onTouchStart={onTouchStart}
			onTouchMove={onTouchMove}
			onTouchEnd={onTouchEnd}
			onTouchCancel={onTouchEnd}
		>
			<div
				className="pointer-events-none flex items-center justify-center overflow-hidden transition-[height] duration-150 md:hidden"
				style={{ height: busy ? 40 : pull }}
				aria-hidden="true"
			>
				<RefreshCw
					className={`h-5 w-5 text-aegisSoft ${busy || progress >= 1 ? 'animate-spin' : ''}`}
					style={{ opacity: busy ? 1 : progress, transform: `rotate(${progress * 180}deg)` }}
				/>
			</div>
			<div className="mb-2 flex justify-end md:mb-3">
				<button
					type="button"
					disabled={disabled || busy}
					onClick={() => void runRefresh()}
					className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-line px-3 text-xs text-muted hover:border-aegis/50 hover:text-cream disabled:opacity-50"
				>
					<RefreshCw className={`h-3.5 w-3.5 ${busy ? 'animate-spin' : ''}`} aria-hidden="true" />
					{busy ? 'Обновляем…' : label}
				</button>
			</div>
			{children}
		</div>
	);
}
