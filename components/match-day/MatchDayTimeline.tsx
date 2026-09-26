'use client';

import type { MatchDayStep } from '@/lib/match-day';

/** Vertical readiness → lobby → score timeline for match day (mobile-first). */
export function MatchDayTimeline({ steps, caption }: { steps: MatchDayStep[]; caption?: string }) {
	return (
		<section aria-label="Ход дня матча" className="mobile-enter rounded-lg border border-line/60 bg-black/25 p-3">
			{caption ? <p className="mb-2 text-[11px] uppercase tracking-wide text-muted">{caption}</p> : null}
			<ol className="space-y-0">
				{steps.map((step, index) => {
					const done = step.state === 'done';
					const current = step.state === 'current';
					return (
						<li key={step.id} className="grid grid-cols-[1.25rem_1fr] gap-x-3">
							<div className="flex flex-col items-center">
								<span
									className={`mt-0.5 flex h-4 w-4 items-center justify-center rounded-full border text-[9px] font-bold ${
										done
											? 'border-radiant bg-radiant/20 text-radiant'
											: current
												? 'ready-wait border-aegis bg-aegis/20 text-aegisSoft'
												: 'border-line text-muted'
									}`}
									aria-hidden="true"
								>
									{done ? '✓' : index + 1}
								</span>
								{index < steps.length - 1 ? (
									<span className={`my-0.5 w-px min-h-[0.75rem] flex-1 ${done ? 'bg-radiant/50' : 'bg-line/70'}`} aria-hidden="true" />
								) : null}
							</div>
							<div className={`pb-3 text-sm ${current ? 'font-semibold text-aegisSoft' : done ? 'text-cream/80' : 'text-muted'}`}>
								{step.label}
								{current ? <span className="ml-2 text-[11px] font-normal text-muted">сейчас</span> : null}
							</div>
						</li>
					);
				})}
			</ol>
		</section>
	);
}
