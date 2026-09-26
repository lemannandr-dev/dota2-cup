'use client';

import type { MatchDayAction, MatchDayStep } from '@/lib/match-day';
import { matchDayHref } from '@/lib/match-day';
import { MatchDayTimeline } from '@/components/match-day/MatchDayTimeline';

export function MatchDayNextStep({
	action,
	href,
	matchId,
	steps
}: {
	action: MatchDayAction;
	href: string;
	matchId?: string | null;
	steps?: MatchDayStep[];
}) {
	const doneCount = steps?.filter((step) => step.state === 'done').length ?? 0;
	const total = steps?.length ?? 0;
	return (
		<div className="space-y-3">
			<a
				href={matchDayHref(href, action.code, matchId)}
				className="inline-flex min-h-11 items-center rounded-lg border border-aegis/50 bg-aegis/10 px-4 py-2 text-sm font-semibold text-aegisSoft hover:border-aegis"
			>
				{action.label}
			</a>
			{action.hint ? <p className="text-xs text-muted">{action.hint}</p> : null}
			{steps && steps.length > 0 ? (
				<div className="space-y-2">
					<p className="text-[11px] uppercase tracking-wide text-muted">
						Чеклист дня · {doneCount}/{total}
					</p>
					<MatchDayTimeline steps={steps} />
				</div>
			) : null}
		</div>
	);
}
