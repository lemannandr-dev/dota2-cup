'use client';

import { ArrowRight } from 'lucide-react';
import { LiveCountdown } from '@/components/ui/LiveCountdown';
import { haptic } from '@/lib/haptics';

type Props = {
	href?: string;
	label: string;
	hint?: string;
	/** Optional ISO deadline shown as live countdown on the CTA. */
	deadlineIso?: string | null;
	urgent?: boolean;
	onClick?: () => void;
	actionKey?: string;
};

export function StickyActionBar({ href, label, hint, deadlineIso, urgent = false, onClick, actionKey }: Props) {
	const className = `aegis-action mx-auto flex min-h-12 w-full max-w-xl items-center justify-between gap-3 rounded-lg bg-aegis px-4 text-left text-ink ${
		urgent ? 'sticky-cta-pulse' : 'shadow-[0_0_24px_rgba(216,168,78,0.22)]'
	}`;

	const inner = (
		<>
			<span className="min-w-0">
				<span className="block text-sm font-bold">{label}</span>
				{hint ? <span className="block truncate text-[11px] text-ink/70">{hint}</span> : null}
			</span>
			<span className="flex shrink-0 items-center gap-2">
				{deadlineIso ? (
					<span className="rounded-md bg-ink/15 px-2 py-1">
						<LiveCountdown iso={deadlineIso} size="sm" ended="!" />
					</span>
				) : null}
				<ArrowRight className="h-5 w-5 shrink-0" aria-hidden="true" />
			</span>
		</>
	);

	return (
		<div
			key={actionKey ?? label}
			className="fixed inset-x-0 bottom-[calc(3.75rem+env(safe-area-inset-bottom))] z-30 border-t border-aegis/30 bg-ink/95 px-3 py-2 backdrop-blur-md md:hidden fade-up"
		>
			{onClick ? (
				<button
					type="button"
					onClick={() => {
						haptic('tap');
						onClick();
					}}
					className={className}
				>
					{inner}
				</button>
			) : (
				<a
					href={href ?? '#'}
					onClick={() => haptic('tap')}
					className={className}
				>
					{inner}
				</a>
			)}
		</div>
	);
}
