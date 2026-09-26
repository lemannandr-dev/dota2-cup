import { describe, expect, it } from 'vitest';
import {
	PULL_THRESHOLD_PX,
	pullDistance,
	pullShouldRefresh,
	sheetShouldDismiss,
	shouldIgnorePullTarget
} from '@/lib/pull-gestures';

describe('pull-gestures', () => {
	it('uses a 72px refresh threshold', () => {
		expect(PULL_THRESHOLD_PX).toBe(72);
		expect(pullShouldRefresh(71)).toBe(false);
		expect(pullShouldRefresh(72)).toBe(true);
	});

	it('resists overscroll and caps visual pull', () => {
		expect(pullDistance(0)).toBe(0);
		expect(pullDistance(-10)).toBe(0);
		expect(pullDistance(100)).toBeCloseTo(55);
		expect(pullDistance(400)).toBeCloseTo(72 * 1.35);
	});

	it('dismisses sheet by distance or flick', () => {
		expect(sheetShouldDismiss({ deltaY: 119, velocity: 0, panelHeight: 480 })).toBe(false);
		expect(sheetShouldDismiss({ deltaY: 120, velocity: 0, panelHeight: 480 })).toBe(true);
		expect(sheetShouldDismiss({ deltaY: 50, velocity: 0, panelHeight: 200 })).toBe(true); // 25% of 200 = 50
		expect(sheetShouldDismiss({ deltaY: 40, velocity: 0.6, panelHeight: 480 })).toBe(true);
		expect(sheetShouldDismiss({ deltaY: 30, velocity: 0.9, panelHeight: 480 })).toBe(false);
	});

	it('ignores interactive and dialog targets', () => {
		expect(shouldIgnorePullTarget(null)).toBe(true);
		// Node/DOM checks are browser-only; unit env has no Element — treated as ignore.
		expect(shouldIgnorePullTarget({} as EventTarget)).toBe(true);
	});
});
