export function RoleBadge({ kind }: { kind: 'captain' | 'deputy' | null | undefined }) {
	if (!kind) return null;
	if (kind === 'captain') {
		return (
			<span
				title="Капитан"
				className="inline-flex items-center gap-1 rounded-full border border-aegis/70 bg-aegis/20 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-aegisSoft"
			>
				<span aria-hidden className="inline-block h-2 w-2 rounded-full bg-aegis shadow-[0_0_8px_2px_rgba(201,162,39,0.8)]" />
				Капитан
			</span>
		);
	}
	return (
		<span
			title="Заместитель капитана"
			className="inline-flex items-center gap-1 rounded-full border border-[#5EE7F2]/70 bg-[#5EE7F2]/15 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-[#5EE7F2]"
		>
			<span aria-hidden className="inline-block h-2 w-2 rounded-full bg-[#5EE7F2] shadow-[0_0_8px_2px_rgba(94,231,242,0.85)]" />
			Зам
		</span>
	);
}
