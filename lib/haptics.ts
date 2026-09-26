'use client';

/** Optional haptic — skipped when reduced-motion or unsupported. */
export function hapticTap(pattern: number | number[] = 12) {
	if (typeof window === 'undefined') return;
	if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
	if (!('vibrate' in navigator) || typeof navigator.vibrate !== 'function') return;
	try {
		navigator.vibrate(pattern);
	} catch {
		/* ignore */
	}
}

/** Named presets used by sticky CTAs (`tap` ≈ light feedback). */
export function haptic(kind: 'tap' | 'success' | 'warn' = 'tap') {
	if (kind === 'success') {
		hapticTap([12, 40, 12]);
		return;
	}
	if (kind === 'warn') {
		hapticTap([24, 30, 24]);
		return;
	}
	hapticTap(10);
}
