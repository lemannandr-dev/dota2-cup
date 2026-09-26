'use client';

import { AEGIS_AWARDS, type AegisAwardId } from '@/lib/aegis-awards';

export function AegisAwardPicker({
	value,
	suggested,
	onChange
}: {
	value: AegisAwardId;
	suggested: AegisAwardId;
	onChange: (id: AegisAwardId) => void;
}) {
	return (
		<fieldset className="space-y-2 md:col-span-2">
			<legend className="text-sm text-cream">Эгида чемпиона</legend>
			<p className="text-xs leading-5 text-muted">
				Одна модель на кубок. Её получит только победитель финала. Финалисту вторую эгиду не ставим. Приз на эскроу —
				отдельно.
			</p>
			<div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
				{AEGIS_AWARDS.map((award) => {
					const selected = value === award.id;
					return (
						<button
							key={award.id}
							type="button"
							onClick={() => onChange(award.id)}
							className={`rounded-xl border px-3 py-2.5 text-left ${
								selected ? 'border-aegis bg-aegis/10' : 'border-line hover:border-aegis/50'
							}`}
						>
							<p className="font-display text-sm text-cream">{award.name}</p>
							<p className="mt-1 text-[11px] leading-4 text-muted">{award.hint}</p>
							{suggested === award.id && (
								<p className="mt-1 text-[10px] uppercase tracking-[0.12em] text-aegisSoft">система советует</p>
							)}
						</button>
					);
				})}
			</div>
		</fieldset>
	);
}
