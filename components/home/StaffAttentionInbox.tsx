import type { AdminAttention } from '@/lib/admin-desk';

export function StaffAttentionInbox({ rows }: { rows: AdminAttention[] }) {
	if (rows.length === 0) return null;
	return (
		<section className="obsidian-glass rounded-card space-y-3 border border-amber-400/30 p-5">
			<div>
				<h2 className="font-display text-lg text-cream">Требует внимания штаба</h2>
				<p className="mt-1 text-sm text-muted">Просрочки, выплаты, чек-ин и споры по вашим турнирам.</p>
			</div>
			<ul className="space-y-2">
				{rows.map((row) => (
					<li key={row.id}>
						<a href={row.href} className="block rounded-lg border border-line px-3 py-2 hover:border-aegis/50">
							<div className="text-sm text-cream">{row.title}</div>
							<div className="text-xs text-muted">{row.hint}</div>
						</a>
					</li>
				))}
			</ul>
		</section>
	);
}
