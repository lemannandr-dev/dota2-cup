'use client';

import React, { useState } from 'react';

const recruitmentOptions = [
	{ value: 'OPEN', label: 'Открыт набор' },
	{ value: 'INVITE_ONLY', label: 'Только по приглашению' },
	{ value: 'CLOSED', label: 'Состав закрыт' }
];

type FormState = {
	name: string;
	tag: string;
	description: string;
	logo: string;
	bannerUrl: string;
	videoUrl: string;
	region: string;
	language: string;
	playstyle: string;
	goals: string;
	contactUrl: string;
	recruitmentStatus: string;
};

type EditableTeam = { id: string; name: string } & Partial<Record<keyof FormState, string | null>>;

const initialState: FormState = {
	name: '',
	tag: '',
	description: '',
	logo: '',
	bannerUrl: '',
	videoUrl: '',
	region: 'CIS',
	language: 'RU',
	playstyle: '',
	goals: '',
	contactUrl: '',
	recruitmentStatus: 'OPEN'
};

type Props = {
	team?: EditableTeam;
	onSaved?: () => void;
};

export function TeamCreateForm({ team, onSaved }: Props = {}) {
	const [form, setForm] = useState<FormState>(() => ({
		...initialState,
		...team,
		tag: team?.tag ?? '',
		description: team?.description ?? '',
		logo: team?.logo ?? '',
		bannerUrl: team?.bannerUrl ?? '',
		videoUrl: team?.videoUrl ?? '',
		region: team?.region ?? initialState.region,
		language: team?.language ?? initialState.language,
		playstyle: team?.playstyle ?? '',
		goals: team?.goals ?? '',
		contactUrl: team?.contactUrl ?? '',
		recruitmentStatus: team?.recruitmentStatus ?? initialState.recruitmentStatus
	}));
	const [error, setError] = useState<string | null>(null);
	const [saving, setSaving] = useState(false);
	const isEditing = Boolean(team?.id);

	function update<K extends keyof FormState>(key: K, value: FormState[K]) {
		setForm((current) => ({ ...current, [key]: value }));
	}

	async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
		event.preventDefault();
		setSaving(true);
		setError(null);

		const res = await fetch(isEditing ? `/api/teams/${team!.id}` : '/api/teams', {
			method: isEditing ? 'PATCH' : 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ ...form, game: 'Dota 2' })
		});

		if (!res.ok) {
			const data = await res.json().catch(() => null);
			setError(data?.error === 'Unauthorized' ? 'Сессия Steam не найдена. Обновите страницу и войдите снова.' : 'Не удалось создать команду. Проверьте поля и попробуйте ещё раз.');
			setSaving(false);
			return;
		}

		onSaved?.();
		window.location.reload();
	}

	return (
		<form id="create-team" onSubmit={handleSubmit} className="obsidian-glass rounded-card scroll-mt-24 p-6 md:p-8 space-y-6">
			<div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
				<div>
					<h2 className="font-display text-2xl text-cream">{isEditing ? 'Редактировать команду' : 'Создать команду'}</h2>
					<p className="mt-2 max-w-2xl text-sm text-muted">
						{isEditing ? 'Обновите профиль команды, медиа, контакты и статус набора.' : 'Заполните профиль команды: он будет виден игрокам и организаторам турниров.'}
					</p>
					<p className="mt-2 max-w-2xl text-xs text-muted">
						Победы, процент и история кубков здесь не вводятся. Они появляются на карточке после заявок и закрытых пар.
					</p>
				</div>
				<span className="inline-flex w-fit rounded-full border border-aegis/40 bg-aegis/10 px-3 py-1 text-xs font-semibold text-aegisSoft">
					{isEditing ? 'Профиль команды' : 'Вы станете капитаном'}
				</span>
			</div>

			<div className="grid grid-cols-1 gap-4 md:grid-cols-3">
				<label className="space-y-2 md:col-span-2">
					<span className="text-sm text-cream">Название</span>
					<input required minLength={2} maxLength={80} value={form.name} onChange={(e) => update('name', e.target.value)} className="w-full rounded-lg border border-line bg-panel px-3 py-2 text-cream outline-none transition focus:border-aegis" placeholder="Aegis Five" />
				</label>
				<label className="space-y-2">
					<span className="text-sm text-cream">Тег</span>
					<input maxLength={12} value={form.tag} onChange={(e) => update('tag', e.target.value.toUpperCase())} className="w-full rounded-lg border border-line bg-panel px-3 py-2 font-mono text-cream outline-none transition focus:border-aegis" placeholder="AGS" />
				</label>
			</div>

			<label className="space-y-2 block">
				<span className="text-sm text-cream">Описание</span>
				<textarea maxLength={1200} value={form.description} onChange={(e) => update('description', e.target.value)} className="min-h-28 w-full rounded-lg border border-line bg-panel px-3 py-2 text-cream outline-none transition focus:border-aegis" placeholder="Кто вы, какой уровень игры, расписание тренировок, кого ищете." />
			</label>

			<div className="grid grid-cols-1 gap-4 md:grid-cols-3">
				<label className="space-y-2">
					<span className="text-sm text-cream">Логотип / аватарка</span>
					<input type="url" value={form.logo} onChange={(e) => update('logo', e.target.value)} className="w-full rounded-lg border border-line bg-panel px-3 py-2 text-cream outline-none transition focus:border-aegis" placeholder="https://… прямая ссылка на картинку" />
					<p className="text-[11px] text-muted">Нужен прямой URL картинки (cdn, imgur). Сайты-обзоры часто блокируют вставку.</p>
				</label>
				<label className="space-y-2">
					<span className="text-sm text-cream">Баннер</span>
					<input type="url" value={form.bannerUrl} onChange={(e) => update('bannerUrl', e.target.value)} className="w-full rounded-lg border border-line bg-panel px-3 py-2 text-cream outline-none transition focus:border-aegis" placeholder="https://..." />
				</label>
				<label className="space-y-2">
					<span className="text-sm text-cream">Видео-визитка</span>
					<input type="url" value={form.videoUrl} onChange={(e) => update('videoUrl', e.target.value)} className="w-full rounded-lg border border-line bg-panel px-3 py-2 text-cream outline-none transition focus:border-aegis" placeholder="YouTube / Twitch / VK" />
				</label>
			</div>

			<div className="grid grid-cols-1 gap-4 md:grid-cols-4">
				<label className="space-y-2">
					<span className="text-sm text-cream">Регион</span>
					<input maxLength={50} value={form.region} onChange={(e) => update('region', e.target.value)} className="w-full rounded-lg border border-line bg-panel px-3 py-2 text-cream outline-none transition focus:border-aegis" placeholder="EU East" />
				</label>
				<label className="space-y-2">
					<span className="text-sm text-cream">Язык</span>
					<input maxLength={30} value={form.language} onChange={(e) => update('language', e.target.value)} className="w-full rounded-lg border border-line bg-panel px-3 py-2 text-cream outline-none transition focus:border-aegis" placeholder="RU / EN" />
				</label>
				<label className="space-y-2">
					<span className="text-sm text-cream">Стиль игры</span>
					<input maxLength={80} value={form.playstyle} onChange={(e) => update('playstyle', e.target.value)} className="w-full rounded-lg border border-line bg-panel px-3 py-2 text-cream outline-none transition focus:border-aegis" placeholder="агрессия, макро, пуш" />
				</label>
				<label className="space-y-2">
					<span className="text-sm text-cream">Набор</span>
					<select value={form.recruitmentStatus} onChange={(e) => update('recruitmentStatus', e.target.value)} className="w-full rounded-lg border border-line bg-panel px-3 py-2 text-cream outline-none transition focus:border-aegis">
						{recruitmentOptions.map((option) => (
							<option key={option.value} value={option.value}>{option.label}</option>
						))}
					</select>
				</label>
			</div>

			<div className="grid grid-cols-1 gap-4 md:grid-cols-2">
				<label className="space-y-2">
					<span className="text-sm text-cream">Цели</span>
					<textarea maxLength={500} value={form.goals} onChange={(e) => update('goals', e.target.value)} className="min-h-24 w-full rounded-lg border border-line bg-panel px-3 py-2 text-cream outline-none transition focus:border-aegis" placeholder="Квалификации, регулярные праки, турниры по выходным." />
				</label>
				<label className="space-y-2">
					<span className="text-sm text-cream">Контакт для заявок</span>
					<input type="url" value={form.contactUrl} onChange={(e) => update('contactUrl', e.target.value)} className="w-full rounded-lg border border-line bg-panel px-3 py-2 text-cream outline-none transition focus:border-aegis" placeholder="Discord / Telegram / сайт" />
				</label>
			</div>

			{error && <div className="rounded-lg border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-200">{error}</div>}

			<div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
				<p className="text-xs text-muted">{isEditing ? 'Изменения обновят карточку команды в каталоге.' : 'После создания команда появится в каталоге, а ваш профиль будет добавлен как подтверждённый капитан.'}</p>
				<button type="submit" disabled={saving} className="rounded-full bg-aegis px-5 py-2.5 text-sm font-semibold text-ink transition hover:bg-aegisSoft disabled:cursor-not-allowed disabled:opacity-60">
					{saving ? 'Сохраняем...' : isEditing ? 'Сохранить команду' : 'Создать команду'}
				</button>
			</div>
		</form>
	);
}