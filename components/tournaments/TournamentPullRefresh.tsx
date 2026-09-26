'use client';

import { useRouter } from 'next/navigation';
import { useCallback, type ReactNode } from 'react';
import { PullToRefresh } from '@/components/ui/PullToRefresh';

/** Soft refresh for server-rendered tournament desk (match board / staff). */
export function TournamentPullRefresh({ children }: { children: ReactNode }) {
	const router = useRouter();
	const refresh = useCallback(async () => {
		router.refresh();
		// Let RSC settle briefly so the spinner is visible.
		await new Promise((resolve) => setTimeout(resolve, 280));
	}, [router]);

	return (
		<PullToRefresh onRefresh={refresh} label="Обновить кубок">
			{children}
		</PullToRefresh>
	);
}
