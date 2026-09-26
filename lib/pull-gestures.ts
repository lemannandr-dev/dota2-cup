/** Pure helpers for pull-to-refresh — kept free of React for unit tests. */

export const PULL_THRESHOLD_PX = 72;

export function shouldIgnorePullTarget(target: EventTarget | null): boolean {
	if (target == null) return true;
	if (typeof Element === 'undefined') return true;
	const node = target instanceof Element ? target : null;
	if (!node) return true;
	if (node.closest('input, textarea, select, [contenteditable="true"], [data-no-pull], [role="dialog"]')) {
		return true;
	}
	return false;
}

/** Resist overscroll and cap the visual pull. */
export function pullDistance(deltaPx: number, threshold = PULL_THRESHOLD_PX): number {
	if (deltaPx <= 0) return 0;
	return Math.min(deltaPx * 0.55, threshold * 1.35);
}

export function pullShouldRefresh(pullPx: number, threshold = PULL_THRESHOLD_PX): boolean {
	return pullPx >= threshold;
}

/** Sheet dismiss: distance past min(120, 25% height) or a downward flick. */
export function sheetShouldDismiss(opts: {
	deltaY: number;
	velocity: number;
	panelHeight: number;
}): boolean {
	const threshold = Math.min(120, opts.panelHeight * 0.25);
	const flick = opts.velocity > 0.55 && opts.deltaY > 36;
	return opts.deltaY >= threshold || flick;
}
