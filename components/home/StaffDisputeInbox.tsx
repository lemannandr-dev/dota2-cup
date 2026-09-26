export type StaffInboxRow = {
	tournamentId: string;
	title: string;
	matchId: string;
	href: string;
	teamA: string;
	teamB: string;
	score: string;
	reason: string;
	ageLabel?: string;
	stale?: boolean;
};

export function StaffDisputeInbox({ rows }: { rows: StaffInboxRow[] }) {
	if (rows.length === 0) return null;
	return (
		<section className="obsidian-glass rounded-card space-y-3 border border-red-400/30 p-5">
			<div>
				<h2 className="font-display text-lg text-cream">Споры, которые ждут вас</h2>
				<p className="mt-1 text-sm text-muted">Вы в штабе этих турниров. Капитан нажал «Отправить судье» — откройте пару и запишите решение.</p>
			</div>
			<ul className="space-y-2">
				{rows.map((row) => (
					<li key={`${row.tournamentId}-${row.matchId}`}>
						<a href={row.href} className={`block rounded-lg border px-3 py-2 hover:border-aegis/50 ${row.stale ? 'border-red-400/40' : 'border-line'}`}>
							<div className="text-sm text-cream">{row.title}</div>
							<div className="text-xs text-muted">
								{row.teamA} — {row.teamB} · {row.score} · {row.reason}
								{row.ageLabel ? ` · ${row.ageLabel}` : ''}
								{row.stale ? ' · висит больше часа' : ''}
							</div>
						</a>
					</li>
				))}
			</ul>
		</section>
	);
}
