'use client';

import { useSyncExternalStore } from 'react';

/** True only after hydration — avoids SSR/client attribute drift from browser tooling. */
export function useIsClient() {
	return useSyncExternalStore(
		() => () => {},
		() => true,
		() => false
	);
}
