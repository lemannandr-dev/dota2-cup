'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { AegisAwardPicker } from '@/components/tournaments/AegisAwardPicker';
import { localHourFromDatetime, parseAegisAward, suggestAegisAward, type AegisAwardId } from '@/lib/aegis-awards';

type Draft = {
	title: string;
	description: string;
	rules: string;
	prizePoolRub: string;
	startAt: string;
	checkInOpensAt: string;
	checkInClosesAt: string;
	region: string;
	rankCap: string;
	seriesRules: string;
	maxTeams: string;
	inviteOnly: boolean;
	aegisAward: AegisAwardId;
	awardTouched: boolean;
};

function toLocal(value?: string | Date | null) {
	if (!value) return '';
	const date = typeof value === 'string' ? new Date(value) : value;
	if (Number.isNaN(date.getTime())) return '';
	return new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
}

export function TournamentEditForm({
	tournamentId,
	initial
}: {
	tournamentId: string;
	initial: {
		title: string;
		description?: string | null;
		rules?: string | null;
		prizePool: number;
		startAt: string | Date;
		checkInOpensAt?: string | Date | null;
		checkInClosesAt?: string | Date | null;
		region?: string | null;
		rankCap?: string | null;
		seriesRules: string;
		maxTeams: number;
		format?: string;
		inviteOnly?: boolean;
		aegisAward?: string;
	};
}) {
	const router = useRouter();
	const [open, setOpen] = useState(false);
	const [busy, setBusy] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [form, setForm] = useState<Draft>({
		title: initial.title,
		description: initial.description ?? '',
		rules: initial.rules ?? '',
		prizePoolRub: String(initial.prizePool / 100),
		startAt: toLocal(initial.startAt),
		checkInOpensAt: toLocal(initial.checkInOpensAt),
		checkInClosesAt: toLocal(initial.checkInClosesAt),
		region: initial.region ?? '',
		rankCap: initial.rankCap ?? '',
		seriesRules: initial.seriesRules,
		maxTeams: String(initial.maxTeams),
		inviteOnly: Boolean(initial.inviteOnly),
		aegisAward: parseAegisAward(initial.aegisAward),
		awardTouched: true
	});

	const suggested = useMemo(
		() =>
			suggestAegisAward({
				format: initial.format,
				seriesRules: form.seriesRules,
				inviteOnly: form.inviteOnly,
				title: form.title,
				description: form.description,
				localHour: localHourFromDatetime(form.startAt)
			}),
		[initial.format, form.seriesRules, form.inviteOnly, form.title, form.description, form.startAt]
	);

	async function save() {
		setBusy(true);
		setError(null);
		const response = await fetch(`/api/tournaments/${tournamentId}`, {
			method: 'PATCH',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({
				title: form.title,
				description: form.description,
				rules: form.rules,
				prizePoolRub: Number(form.prizePoolRub),
				startAt: form.startAt ? new Date(form.startAt).toISOString() : undefined,
				checkInOpensAt: form.checkInOpensAt ? new Date(form.checkInOpensAt).toISOString() : null,
				checkInClosesAt: form.checkInClosesAt ? new Date(form.checkInClosesAt).toISOString() : null,
				region: form.region,
				rankCap: form.rankCap,
				seriesRules: form.seriesRules,
				maxTeams: Number(form.maxTeams),
				aegisAward: form.aegisAward,
				inviteOnly: form.inviteOnly
			})
		});
		const body = await response.json().catch(() => null);
		if (!response.ok) setError(body?.error || 'Не сохранилось');
		else {
			setOpen(false);
			router.refresh();
		}
		setBusy(false);
	}

	return (
		<section className="obsidian-glass space-y-3 rounded-card p-5">
			<div className="flex items-center justify-between gap-3">
				<div>
					<h3 className="font-display text-xl text-cream">Правка кубка</h3>
					<p className="text-sm text-muted">До LIVE: даты, фонд, правила. Если фонд вырастет — эскроу снова не подтверждён.</p>
				</div>
				<button type="button" onClick={() => setOpen((value) => !value)} className="text-sm text-aegisSoft">
					{open ? 'Скрыть' : 'Изменить'}
				</button>
			</div>
			{open && (
				<div className="grid gap-2 md:grid-cols-2">
					<input value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} className="rounded-lg border border-line bg-panel px-3 py-2 text-cream md:col-span-2" />
					<input value={form.prizePoolRub} onChange={(event) => setForm({ ...form, prizePoolRub: event.target.value })} placeholder="Фонд, ₽" className="rounded-lg border border-line bg-panel px-3 py-2 text-cream" />
					<input type="datetime-local" value={form.startAt} onChange={(event) => setForm({ ...form, startAt: event.target.value })} className="rounded-lg border border-line bg-panel px-3 py-2 text-cream" />
					<input type="datetime-local" value={form.checkInOpensAt} onChange={(event) => setForm({ ...form, checkInOpensAt: event.target.value })} className="rounded-lg border border-line bg-panel px-3 py-2 text-cream" />
					<input type="datetime-local" value={form.checkInClosesAt} onChange={(event) => setForm({ ...form, checkInClosesAt: event.target.value })} className="rounded-lg border border-line bg-panel px-3 py-2 text-cream" />
					<textarea value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} placeholder="Описание" className="rounded-lg border border-line bg-panel px-3 py-2 text-cream md:col-span-2" />
					<textarea value={form.rules} onChange={(event) => setForm({ ...form, rules: event.target.value })} placeholder="Правила" className="rounded-lg border border-line bg-panel px-3 py-2 text-cream md:col-span-2" />
					<label className="flex items-center gap-2 text-sm text-cream md:col-span-2">
						<input type="checkbox" checked={form.inviteOnly} onChange={(event) => setForm({ ...form, inviteOnly: event.target.checked })} />
						Закрытый инвайт
					</label>
					<div className="md:col-span-2">
						<AegisAwardPicker value={form.aegisAward} suggested={suggested} onChange={(id) => setForm({ ...form, aegisAward: id, awardTouched: true })} />
					</div>
					<button type="button" disabled={busy} onClick={() => void save()} className="rounded-full bg-aegis px-4 py-2 text-sm font-semibold text-ink md:col-span-2">
						{busy ? 'Пишу…' : 'Сохранить'}
					</button>
					{error && <p className="text-sm text-red-200 md:col-span-2">{error}</p>}
				</div>
			)}
		</section>
	);
}
