'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { AegisAwardPicker } from '@/components/tournaments/AegisAwardPicker';
import { localHourFromDatetime, parseAegisAward, suggestAegisAward, type AegisAwardId } from '@/lib/aegis-awards';
import {
	TOURNAMENT_CREATE_DRAFT_KEY,
	TOURNAMENT_CREATE_STEPS,
	emptyTournamentCreateDraft,
	nextTournamentCreateStep,
	parseTournamentCreateDraft,
	prevTournamentCreateStep,
	previewCreatePrize,
	validateTournamentCreateStep,
	type TournamentCreateDraft,
	type TournamentCreateWizardStep
} from '@/lib/tournament-create-wizard';

type FormState = Omit<TournamentCreateDraft, 'savedAt'>;

function toIso(local: string): string | undefined {
	if (!local) return undefined;
	return new Date(local).toISOString();
}

function fieldClass() {
	return 'min-h-12 w-full rounded-lg border border-line bg-panel px-3 text-base text-cream outline-none focus:border-aegis';
}

export function TournamentCreateForm({ walletBalance = 0 }: { walletBalance?: number }) {
	const router = useRouter();
	const [form, setForm] = useState<FormState>(() => emptyTournamentCreateDraft());
	const [hydrated, setHydrated] = useState(false);
	const [saving, setSaving] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [draftNote, setDraftNote] = useState<string | null>(null);
	const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

	useEffect(() => {
		try {
			const raw = localStorage.getItem(TOURNAMENT_CREATE_DRAFT_KEY);
			if (raw) {
				const parsed = parseTournamentCreateDraft(JSON.parse(raw));
				if (parsed) {
					const { savedAt, ...rest } = parsed;
					setForm(rest);
					setDraftNote(`Черновик с ${new Date(savedAt).toLocaleString('ru-RU')}`);
				}
			}
		} catch {
			/* ignore bad draft */
		}
		setHydrated(true);
	}, []);

	useEffect(() => {
		if (!hydrated) return;
		if (saveTimer.current) clearTimeout(saveTimer.current);
		saveTimer.current = setTimeout(() => {
			const payload: TournamentCreateDraft = { ...form, savedAt: new Date().toISOString() };
			try {
				localStorage.setItem(TOURNAMENT_CREATE_DRAFT_KEY, JSON.stringify(payload));
				setDraftNote('Черновик сохранён на этом устройстве');
			} catch {
				setDraftNote('Не удалось сохранить черновик локально');
			}
		}, 400);
		return () => {
			if (saveTimer.current) clearTimeout(saveTimer.current);
		};
	}, [form, hydrated]);

	function update<K extends keyof FormState>(key: K, value: FormState[K]) {
		setForm((prev) => ({ ...prev, [key]: value }));
	}

	const suggested = useMemo(
		() =>
			suggestAegisAward({
				format: form.format,
				seriesRules: form.seriesRules,
				inviteOnly: form.inviteOnly,
				title: form.title,
				description: form.description,
				localHour: localHourFromDatetime(form.startAt)
			}),
		[form.format, form.seriesRules, form.inviteOnly, form.title, form.description, form.startAt]
	);
	const award = form.awardTouched ? form.aegisAward : suggested;
	const prizePreview = useMemo(
		() => previewCreatePrize(Number(form.prizePool || 0), walletBalance),
		[form.prizePool, walletBalance]
	);
	const stepIndex = TOURNAMENT_CREATE_STEPS.findIndex((row) => row.id === form.step);

	function go(next: TournamentCreateWizardStep) {
		setError(null);
		update('step', next);
	}

	function onNext() {
		const invalid = validateTournamentCreateStep(form.step, form);
		if (invalid) {
			setError(invalid);
			return;
		}
		const next = nextTournamentCreateStep(form.step);
		if (next) go(next);
	}

	function onBack() {
		const prev = prevTournamentCreateStep(form.step);
		if (prev) go(prev);
	}

	function clearDraft() {
		localStorage.removeItem(TOURNAMENT_CREATE_DRAFT_KEY);
		setForm(emptyTournamentCreateDraft());
		setDraftNote(null);
		setError(null);
	}

	async function handleSubmit() {
		const invalid =
			validateTournamentCreateStep('basics', form) ||
			validateTournamentCreateStep('schedule', form) ||
			validateTournamentCreateStep('prize', form);
		if (invalid) {
			setError(invalid);
			return;
		}
		setSaving(true);
		setError(null);
		const startAt = toIso(form.startAt);
		if (!startAt) {
			setError('Укажите дату старта');
			setSaving(false);
			return;
		}
		const idem =
			typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
				? crypto.randomUUID()
				: `create-${Date.now()}`;
		const res = await fetch('/api/tournaments', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json', 'Idempotency-Key': idem },
			credentials: 'same-origin',
			body: JSON.stringify({
				title: form.title,
				description: form.description || undefined,
				format: form.format,
				maxTeams: Number(form.maxTeams),
				seriesRules: form.seriesRules,
				region: form.region || undefined,
				rankCap: form.rankCap || undefined,
				prizePool: Math.max(0, Math.round(Number(form.prizePool || 0) * 100)),
				startAt,
				checkInOpensAt: toIso(form.checkInOpensAt),
				checkInClosesAt: toIso(form.checkInClosesAt),
				rules: form.rules || undefined,
				twitchChannel: form.twitchChannel || undefined,
				twitchSecondary: form.twitchSecondary || undefined,
				youtubeUrl: form.youtubeUrl || undefined,
				youtubeSecondaryUrl: form.youtubeSecondaryUrl || undefined,
				dotaTv: form.dotaTv || undefined,
				lobbyName: form.lobbyName || undefined,
				delaySec: Math.max(0, Number(form.delaySec || 0) || 0),
				overlayTitle: form.overlayTitle || undefined,
				aegisAward: parseAegisAward(award),
				inviteOnly: form.inviteOnly
			})
		});
		const data = await res.json().catch(() => null);
		if (!res.ok) {
			setError(data?.error || 'Не удалось создать турнир');
			setSaving(false);
			return;
		}
		localStorage.removeItem(TOURNAMENT_CREATE_DRAFT_KEY);
		router.push(`/tournaments/${data.tournament.id}`);
	}

	return (
		<div className="obsidian-glass space-y-5 rounded-card p-5 md:p-8">
			<div className="space-y-2">
				<h2 className="font-display text-2xl text-cream">Новый турнир</h2>
				<p className="text-sm text-muted">Пять шагов. Черновик пишется на устройстве при каждом изменении — можно закрыть вкладку и вернуться.</p>
				{draftNote ? <p className="text-xs text-aegisSoft">{draftNote}</p> : null}
			</div>

			<ol className="flex gap-2 overflow-x-auto pb-1" aria-label="Шаги создания">
				{TOURNAMENT_CREATE_STEPS.map((row, index) => {
					const active = row.id === form.step;
					const done = index < stepIndex;
					return (
						<li key={row.id}>
							<button
								type="button"
								onClick={() => {
									if (index <= stepIndex) go(row.id);
								}}
								className={`inline-flex min-h-11 items-center gap-2 rounded-lg border px-3 text-sm ${
									active ? 'border-aegis bg-aegis/15 text-aegisSoft' : done ? 'border-line text-cream' : 'border-line/50 text-muted'
								}`}
							>
								<span className="font-mono text-xs">{index + 1}</span>
								{row.label}
							</button>
						</li>
					);
				})}
			</ol>

			{form.step === 'basics' && (
				<div className="grid grid-cols-1 gap-4 md:grid-cols-2">
					<label className="space-y-2 md:col-span-2">
						<span className="text-sm text-cream">Название</span>
						<input required minLength={3} value={form.title} onChange={(e) => update('title', e.target.value)} className={fieldClass()} />
					</label>
					<label className="space-y-2">
						<span className="text-sm text-cream">Формат</span>
						<select value={form.format} onChange={(e) => update('format', e.target.value as FormState['format'])} className={fieldClass()}>
							<option value="SINGLE_ELIMINATION">Single Elimination</option>
							<option value="DOUBLE_ELIMINATION">Double Elimination</option>
						</select>
					</label>
					<label className="space-y-2">
						<span className="text-sm text-cream">Слоты</span>
						<select value={form.maxTeams} onChange={(e) => update('maxTeams', e.target.value as FormState['maxTeams'])} className={fieldClass()}>
							<option value="8">8</option>
							<option value="16">16</option>
							<option value="32">32</option>
						</select>
					</label>
					<label className="space-y-2">
						<span className="text-sm text-cream">Серия</span>
						<input value={form.seriesRules} onChange={(e) => update('seriesRules', e.target.value)} className={fieldClass()} placeholder="BO1 / BO3" />
					</label>
					<label className="flex items-center gap-2 text-sm text-cream md:col-span-2">
						<input type="checkbox" checked={form.inviteOnly} onChange={(e) => update('inviteOnly', e.target.checked)} />
						Закрытый инвайт — заявку с каталога не принимают
					</label>
					<label className="space-y-2 md:col-span-2">
						<span className="text-sm text-cream">Описание</span>
						<textarea value={form.description} onChange={(e) => update('description', e.target.value)} className={`min-h-24 ${fieldClass()}`} />
					</label>
					<AegisAwardPicker
						value={award}
						suggested={suggested}
						onChange={(id: AegisAwardId) => setForm((prev) => ({ ...prev, aegisAward: id, awardTouched: true }))}
					/>
				</div>
			)}

			{form.step === 'schedule' && (
				<div className="grid grid-cols-1 gap-4 md:grid-cols-2">
					<label className="space-y-2">
						<span className="text-sm text-cream">Старт</span>
						<input required type="datetime-local" value={form.startAt} onChange={(e) => update('startAt', e.target.value)} className={fieldClass()} />
					</label>
					<label className="space-y-2">
						<span className="text-sm text-cream">Check-in открытие</span>
						<input type="datetime-local" value={form.checkInOpensAt} onChange={(e) => update('checkInOpensAt', e.target.value)} className={fieldClass()} />
					</label>
					<label className="space-y-2">
						<span className="text-sm text-cream">Check-in закрытие</span>
						<input type="datetime-local" value={form.checkInClosesAt} onChange={(e) => update('checkInClosesAt', e.target.value)} className={fieldClass()} />
					</label>
					<label className="space-y-2">
						<span className="text-sm text-cream">Регион</span>
						<input value={form.region} onChange={(e) => update('region', e.target.value)} className={fieldClass()} />
					</label>
					<label className="space-y-2 md:col-span-2">
						<span className="text-sm text-cream">Rank cap</span>
						<input value={form.rankCap} onChange={(e) => update('rankCap', e.target.value)} className={fieldClass()} />
					</label>
				</div>
			)}

			{form.step === 'prize' && (
				<div className="space-y-4">
					<label className="block space-y-2">
						<span className="text-sm text-cream">Приз, ₽</span>
						<input type="number" min={0} value={form.prizePool} onChange={(e) => update('prizePool', e.target.value)} className={fieldClass()} />
					</label>
					<div className="rounded-lg border border-line/70 bg-black/20 p-3 text-sm">
						<p className="text-cream">{prizePreview.hint}</p>
						<p className="mt-2 text-xs text-muted">
							Кошелёк: {prizePreview.wallet.haveLabel} · фонд {prizePreview.prizeLabel}
							{prizePreview.wallet.shortfall > 0 ? ` · не хватает ${prizePreview.wallet.shortfallLabel}` : ''}
						</p>
						{prizePreview.lines.length > 0 && (
							<ul className="mt-3 space-y-1 text-sm text-cream">
								{prizePreview.lines.map((line) => (
									<li key={line.place} className="flex justify-between gap-2">
										<span>
											{line.place} место · {line.shareLabel}
										</span>
										<span className="text-aegisSoft">{line.amountLabel}</span>
									</li>
								))}
							</ul>
						)}
					</div>
				</div>
			)}

			{form.step === 'broadcast' && (
				<div className="grid grid-cols-1 gap-4 md:grid-cols-2">
					<label className="space-y-2">
						<span className="text-sm text-cream">Twitch стол</span>
						<input value={form.twitchChannel} onChange={(e) => update('twitchChannel', e.target.value)} className={fieldClass()} placeholder="dota2ti" />
					</label>
					<label className="space-y-2">
						<span className="text-sm text-cream">Twitch второй язык</span>
						<input value={form.twitchSecondary} onChange={(e) => update('twitchSecondary', e.target.value)} className={fieldClass()} />
					</label>
					<label className="space-y-2">
						<span className="text-sm text-cream">YouTube стол</span>
						<input value={form.youtubeUrl} onChange={(e) => update('youtubeUrl', e.target.value)} className={fieldClass()} />
					</label>
					<label className="space-y-2">
						<span className="text-sm text-cream">YouTube второй язык</span>
						<input value={form.youtubeSecondaryUrl} onChange={(e) => update('youtubeSecondaryUrl', e.target.value)} className={fieldClass()} />
					</label>
					<label className="space-y-2">
						<span className="text-sm text-cream">Dota TV / Match ID</span>
						<input value={form.dotaTv} onChange={(e) => update('dotaTv', e.target.value)} className={fieldClass()} />
					</label>
					<label className="space-y-2">
						<span className="text-sm text-cream">Имя лобби</span>
						<input value={form.lobbyName} onChange={(e) => update('lobbyName', e.target.value)} className={fieldClass()} />
					</label>
					<label className="space-y-2">
						<span className="text-sm text-cream">Задержка стола, сек</span>
						<input type="number" min={0} max={600} value={form.delaySec} onChange={(e) => update('delaySec', e.target.value)} className={fieldClass()} />
					</label>
					<label className="space-y-2">
						<span className="text-sm text-cream">Титр оверлея</span>
						<input value={form.overlayTitle} onChange={(e) => update('overlayTitle', e.target.value)} className={fieldClass()} />
					</label>
				</div>
			)}

			{form.step === 'review' && (
				<div className="space-y-4">
					<label className="block space-y-2">
						<span className="text-sm text-cream">Правила</span>
						<textarea value={form.rules} onChange={(e) => update('rules', e.target.value)} className={`min-h-28 ${fieldClass()}`} />
					</label>
					<div className="rounded-lg border border-line/70 bg-black/20 p-3 text-sm text-cream">
						<p className="font-semibold">{form.title || 'Без названия'}</p>
						<p className="mt-1 text-xs text-muted">
							{form.format === 'DOUBLE_ELIMINATION' ? 'Double' : 'Single'} · {form.maxTeams} слотов · {form.seriesRules} · приз {prizePreview.prizeLabel}
						</p>
						<p className="mt-2 text-xs text-muted">{prizePreview.hint}</p>
					</div>
				</div>
			)}

			{error && <div className="rounded-lg border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-200">{error}</div>}

			<div className="hidden flex-wrap gap-2 md:flex">
				<button type="button" onClick={clearDraft} className="min-h-11 rounded-lg border border-line px-4 text-sm text-muted">
					Сбросить черновик
				</button>
				{form.step !== 'basics' && (
					<button type="button" onClick={onBack} className="min-h-11 rounded-lg border border-line px-4 text-sm text-cream">
						Назад
					</button>
				)}
				{form.step !== 'review' ? (
					<button type="button" onClick={onNext} className="min-h-11 rounded-lg bg-aegis px-5 text-sm font-semibold text-ink">
						Далее
					</button>
				) : (
					<button type="button" disabled={saving} onClick={() => void handleSubmit()} className="min-h-11 rounded-lg bg-aegis px-5 text-sm font-semibold text-ink disabled:opacity-60">
						{saving ? 'Сохраняем…' : prizePreview.opensAsDraft ? 'Сохранить черновик' : 'Открыть регистрацию'}
					</button>
				)}
			</div>

			<div className="fixed inset-x-0 bottom-[calc(3.75rem+env(safe-area-inset-bottom))] z-30 flex gap-2 border-t border-line/70 bg-ink/95 px-3 py-2 backdrop-blur-md md:hidden">
				<button type="button" onClick={clearDraft} className="min-h-12 rounded-lg border border-line px-3 text-sm text-muted">
					Сброс
				</button>
				{form.step !== 'basics' && (
					<button type="button" onClick={onBack} className="min-h-12 flex-1 rounded-lg border border-line px-3 text-sm text-cream">
						Назад
					</button>
				)}
				{form.step !== 'review' ? (
					<button type="button" onClick={onNext} className="aegis-action min-h-12 flex-[1.4] rounded-lg bg-aegis px-4 text-sm font-semibold text-ink">
						Далее
					</button>
				) : (
					<button type="button" disabled={saving} onClick={() => void handleSubmit()} className="aegis-action min-h-12 flex-[1.4] rounded-lg bg-aegis px-4 text-sm font-semibold text-ink disabled:opacity-60">
						{saving ? '…' : 'Создать'}
					</button>
				)}
			</div>
			<div className="h-20 md:hidden" aria-hidden="true" />
		</div>
	);
}
