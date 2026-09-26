'use client';

import { useState, type CSSProperties } from 'react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { ArenaCover } from '@/components/layout/ArenaCover';
import { Cloud, HardDrive, ImageIcon, Link2, LoaderCircle, RotateCcw, Save, Upload } from 'lucide-react';
import {
	DEFAULT_SITE_APPEARANCE,
	type AppearanceAssetField,
	type AppearanceStorageKind,
	type SiteAppearance
} from '@/lib/site-appearance';

type SourceMode = 'url' | AppearanceStorageKind;

const assets: Array<{
	field: AppearanceAssetField;
	label: string;
	hint: string;
	previewClass: string;
}> = [
	{
		field: 'homeCoverUrl',
		label: 'Обложка главной',
		hint: 'Герои и арт Dota 2. Широкое изображение, ключевой герой ближе к центру.',
		previewClass: 'aspect-[2/1] w-full rounded-lg object-cover'
	},
	{
		field: 'appLogoUrl',
		label: 'Логотип Aegis Arena',
		hint: 'Логотип в шапке сайта. Квадратный PNG/WebP, желательно 512×512. Иконка установленного приложения меняется при сборке.',
		previewClass: 'h-20 w-20 rounded-lg object-cover'
	},
	{
		field: 'dotaLogoUrl',
		label: 'Знак Dota 2',
		hint: 'Контрастный квадратный знак. Он показывается рядом с брендом в шапке.',
		previewClass: 'h-20 w-20 rounded-lg bg-dire/80 object-contain p-2'
	},
	{
		field: 'mobileBackdropUrl',
		label: 'Фон арены',
		hint: 'Широкое изображение от 1440×800. Центр композиции должен оставаться понятным на телефоне.',
		previewClass: 'h-28 w-full object-cover'
	}
];

const initialModes: Record<AppearanceAssetField, SourceMode> = {
	appLogoUrl: 'url',
	dotaLogoUrl: 'url',
	mobileBackdropUrl: 'url',
	homeCoverUrl: 'url'
};

export function AppearanceEditor({
	initialAppearance,
	s3Available
}: {
	initialAppearance: SiteAppearance;
	s3Available: boolean;
}) {
	const router = useRouter();
	const [draft, setDraft] = useState(initialAppearance);
	const [saved, setSaved] = useState(initialAppearance);
	const dirty = JSON.stringify(draft) !== JSON.stringify(saved);
	const [modes, setModes] = useState(initialModes);
	const [files, setFiles] = useState<Partial<Record<AppearanceAssetField, File>>>({});
	const [busy, setBusy] = useState<string | null>(null);
	const [notice, setNotice] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null);

	const previewStyle = {
		'--preview-opacity': `${draft.backdropOpacity / 100}`,
		'--preview-position-y': `${draft.backdropPositionY}%`
	} as CSSProperties;

	async function requestAppearance(url: string, init: RequestInit) {
		const response = await fetch(url, { ...init, signal: AbortSignal.timeout(45000) });
		const payload = (await response.json().catch(() => ({}))) as { appearance?: SiteAppearance; error?: string; url?: string };
		if (!response.ok) throw new Error(payload.error || 'Не удалось сохранить оформление');
		return payload;
	}

	async function saveAppearance(patch?: Partial<SiteAppearance>) {
		setBusy('save');
		setNotice(null);
		try {
			const payload = await requestAppearance('/api/admin/appearance', {
				method: 'PATCH',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(
					patch || {
						appLogoUrl: draft.appLogoUrl,
						dotaLogoUrl: draft.dotaLogoUrl,
						mobileBackdropUrl: draft.mobileBackdropUrl,
						homeCoverUrl: draft.homeCoverUrl,
						motionEnabled: draft.motionEnabled,
						backdropOpacity: draft.backdropOpacity,
						backdropPositionY: draft.backdropPositionY
					}
				)
			});
			if (payload.appearance) { setDraft(payload.appearance); setSaved(payload.appearance); }
			router.refresh();
			setNotice({ kind: 'ok', text: 'Оформление сохранено и уже применяется на сайте.' });
			return payload.appearance;
		} catch (error) {
			setNotice({ kind: 'error', text: error instanceof Error ? error.message : 'Не удалось сохранить оформление' });
			return null;
		} finally {
			setBusy(null);
		}
	}

	async function uploadAsset(field: AppearanceAssetField, storage: AppearanceStorageKind) {
		const file = files[field];
		if (!file) {
			setNotice({ kind: 'error', text: 'Сначала выберите изображение.' });
			return;
		}
		setBusy(field);
		setNotice(null);
		try {
			const form = new FormData();
			form.set('file', file);
			form.set('field', field);
			form.set('storage', storage);
			const upload = await requestAppearance('/api/admin/appearance/upload', { method: 'POST', body: form });
			if (!upload.url) throw new Error('Сервер не вернул адрес изображения');
			setDraft((current) => ({ ...current, [field]: upload.url! }));
			setFiles((current) => ({ ...current, [field]: undefined }));
			setNotice({ kind: 'ok', text: `Изображение загружено ${storage === 's3' ? 'в S3' : 'в папку'}. Сохраните оформление, чтобы опубликовать.` });
		} catch (error) {
			setNotice({ kind: 'error', text: error instanceof Error ? error.message : 'Ошибка загрузки' });
		} finally {
			setBusy(null);
		}
	}

	async function resetAppearance() {
		if (!window.confirm('Вернуть стандартные логотипы, фон и параметры движения?')) return;
		setBusy('reset');
		setNotice(null);
		try {
			const payload = await requestAppearance('/api/admin/appearance', { method: 'DELETE' });
			setDraft(payload.appearance || { ...DEFAULT_SITE_APPEARANCE });
			setSaved(payload.appearance || { ...DEFAULT_SITE_APPEARANCE });
			setFiles({});
			router.refresh();
			setNotice({ kind: 'ok', text: 'Стандартное оформление восстановлено.' });
		} catch (error) {
			setNotice({ kind: 'error', text: error instanceof Error ? error.message : 'Не удалось сбросить оформление' });
		} finally {
			setBusy(null);
		}
	}

	return (
		<div className="grid items-start gap-6 lg:grid-cols-[320px_minmax(0,1fr)]">
			<section aria-labelledby="appearance-preview-title" className="space-y-3 lg:sticky lg:top-24">
				<div className="flex items-end justify-between gap-3">
					<div>
						<h2 id="appearance-preview-title" className="font-display text-xl text-cream">Оформление</h2>
						<p className="mt-1 text-sm text-muted">Предпросмотр главной</p>
					</div>
					<span className={`text-xs ${dirty ? 'text-aegisSoft' : 'text-radiant'}`}>{dirty ? 'Черновик' : 'Сохранено'}</span>
				</div>
				<div className="appearance-phone-preview" style={previewStyle}>
					<Image
						src={draft.mobileBackdropUrl}
						alt="Предпросмотр фона арены"
						fill
						sizes="320px"
						unoptimized
						className={`appearance-preview-backdrop ${draft.motionEnabled ? 'is-moving' : ''}`}
					/>
					<div className="appearance-preview-header">
						<Image src={draft.appLogoUrl} alt="Логотип Aegis Arena" width={36} height={36} unoptimized className="h-9 w-9 rounded-lg object-cover" />
						<span className="h-6 w-px bg-white/20" />
						<span className={`dota-brand-mark h-8 w-8 ${draft.motionEnabled ? 'is-moving' : ''}`}>
							<Image src={draft.dotaLogoUrl} alt="Логотип Dota 2" width={20} height={20} unoptimized className="h-5 w-5 object-contain" />
						</span>
						<span className="ml-auto h-8 w-8 rounded-lg border border-white/15 bg-black/20" />
					</div>
					<div className="relative z-[2]"><ArenaCover appearance={draft} compact /></div>
				</div>
			</section>
			<fieldset disabled={busy !== null} className="min-w-0 space-y-6 pb-24 md:pb-0">
			<section aria-labelledby="appearance-motion-title" className="space-y-4 border-b border-line pb-5">
				<div className="flex flex-wrap items-start justify-between gap-3">
					<div>
						<h2 id="appearance-motion-title" className="font-display text-base text-cream">Движение и кадрирование</h2>
						<p className="mt-1 text-xs text-muted">Параметры применяются ко всему мобильному интерфейсу.</p>
					</div>
					<label className="inline-flex min-h-11 shrink-0 cursor-pointer items-center gap-2 text-sm text-cream">
						<input
							type="checkbox"
							checked={draft.motionEnabled}
							onChange={(event) => setDraft((current) => ({ ...current, motionEnabled: event.target.checked }))}
							className="h-5 w-5 accent-aegis"
						/>
						Анимация
					</label>
				</div>
				<label className="block text-sm text-cream">
					<span className="flex justify-between gap-3"><span>Выразительность фона</span><span className="font-mono text-aegisSoft">{draft.backdropOpacity}%</span></span>
					<input type="range" min="8" max="45" value={draft.backdropOpacity} onChange={(event) => setDraft((current) => ({ ...current, backdropOpacity: Number(event.target.value) }))} className="mt-2 w-full accent-aegis" />
				</label>
				<label className="block text-sm text-cream">
					<span className="flex justify-between gap-3"><span>Центр кадра по вертикали</span><span className="font-mono text-aegisSoft">{draft.backdropPositionY}%</span></span>
					<input type="range" min="0" max="100" value={draft.backdropPositionY} onChange={(event) => setDraft((current) => ({ ...current, backdropPositionY: Number(event.target.value) }))} className="mt-2 w-full accent-aegis" />
				</label>
			</section>

			<section aria-labelledby="appearance-assets-title" className="space-y-3">
				<div>
					<h2 id="appearance-assets-title" className="font-display text-xl text-cream">Изображения</h2>
					<p className="mt-1 text-sm text-muted">До 10 МБ. GIF сохраняется первым кадром; движение задаётся выше.</p>
				</div>
				{assets.map((asset) => {
					const mode = modes[asset.field];
					const file = files[asset.field];
					return (
						<article key={asset.field} className="obsidian-glass rounded-card p-4 md:p-5">
							<div className="grid gap-4 md:grid-cols-[minmax(10rem,15rem)_1fr] md:items-start">
								<div className="overflow-hidden">
									<Image src={draft[asset.field]} alt={`Предпросмотр: ${asset.label}`} width={320} height={180} unoptimized className={asset.previewClass} />
								</div>
								<div className="min-w-0 space-y-3">
									<div>
										<h3 className="text-sm font-semibold text-cream">{asset.label}</h3>
										<p className="mt-1 text-xs leading-5 text-muted">{asset.hint}</p>
									</div>
									<div className="grid grid-cols-3 gap-1 rounded-lg border border-line bg-ink/60 p-1" role="group" aria-label={`Источник: ${asset.label}`}>
										{([
											{ value: 'url', label: 'URL', icon: Link2 },
											{ value: 'local', label: 'Папка', icon: HardDrive },
											{ value: 's3', label: 'S3', icon: Cloud }
										] as const).map((source) => {
											const Icon = source.icon;
											const disabled = source.value === 's3' && !s3Available;
											return (
												<button
													type="button"
													key={source.value}
												disabled={disabled}
												aria-pressed={mode === source.value}
													title={disabled ? 'Заполните S3_ENDPOINT, S3_ACCESS_KEY и S3_SECRET_KEY' : source.label}
													onClick={() => setModes((current) => ({ ...current, [asset.field]: source.value }))}
													className={`inline-flex min-h-11 items-center justify-center gap-1.5 rounded-lg px-2 text-xs transition-colors ${mode === source.value ? 'bg-aegis text-ink' : 'text-muted hover:text-cream'} disabled:cursor-not-allowed disabled:opacity-35`}
												>
													<Icon className="h-4 w-4" aria-hidden="true" />
													{source.label}
												</button>
											);
										})}
									</div>
									{mode === 'url' ? (
										<label className="block text-xs text-muted">
											<span className="sr-only">URL: {asset.label}</span>
											<input
												type="text"
												inputMode="url"
												value={draft[asset.field]}
												spellCheck={false}
												onChange={(event) => setDraft((current) => ({ ...current, [asset.field]: event.target.value }))}
												placeholder="https://… или /внутренний-путь"
												className="min-h-12 w-full rounded-lg border border-line bg-ink px-3 text-base text-cream outline-none focus:border-aegis"
											/>
										</label>
									) : (
										<div className="flex flex-col gap-2 sm:flex-row">
											<label className="inline-flex min-h-12 min-w-0 flex-1 cursor-pointer items-center gap-2 rounded-lg border border-line bg-ink px-3 text-sm text-cream hover:border-aegis/60">
												<ImageIcon className="h-4 w-4 shrink-0 text-aegisSoft" aria-hidden="true" />
												<span className="min-w-0 truncate">{file?.name || 'Выбрать изображение'}</span>
												<input
													type="file"
													accept="image/png,image/jpeg,image/webp,image/gif,image/avif"
													className="sr-only"
													aria-label={`Файл: ${asset.label}`}
													onChange={(event) => {
														const file = event.currentTarget.files?.[0];
														setFiles((current) => ({ ...current, [asset.field]: file }));
														event.currentTarget.value = '';
													}}
												/>
											</label>
											<button
												type="button"
												disabled={!file || busy !== null}
												onClick={() => uploadAsset(asset.field, mode)}
												className="aegis-action inline-flex min-h-12 shrink-0 items-center justify-center gap-2 rounded-lg bg-aegis px-4 text-sm font-bold text-ink disabled:opacity-40"
											>
												{busy === asset.field ? <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden="true" /> : <Upload className="h-4 w-4" aria-hidden="true" />}
												Загрузить
											</button>
										</div>
									)}
								</div>
							</div>
						</article>
					);
				})}
			</section>

			<div className="fixed inset-x-0 bottom-[calc(3.75rem+env(safe-area-inset-bottom))] z-30 border-y border-line bg-ink/95 p-3 backdrop-blur md:sticky md:bottom-3 md:rounded-lg md:border">
				{notice && (
					<p role="status" className={`mb-2 text-sm ${notice.kind === 'ok' ? 'text-radiant' : 'text-dire'}`}>{notice.text}</p>
				)}
				<div className="flex gap-2">
					<button type="button" aria-label="Восстановить стандартное оформление" title="Восстановить стандартное оформление" onClick={resetAppearance} disabled={busy !== null} className="inline-flex min-h-12 items-center justify-center gap-2 rounded-lg border border-line px-3 text-sm text-muted hover:text-cream disabled:opacity-40">
						<RotateCcw className="h-4 w-4" aria-hidden="true" />
						<span className="hidden sm:inline">По умолчанию</span>
					</button>
					<button type="button" onClick={() => saveAppearance()} disabled={busy !== null || !dirty} className="aegis-action inline-flex min-h-12 flex-1 items-center justify-center gap-2 rounded-lg bg-aegis px-3 text-sm font-bold text-ink disabled:opacity-40">
						{busy === 'save' ? <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden="true" /> : <Save className="h-4 w-4" aria-hidden="true" />}
						Сохранить оформление
					</button>
				</div>
			</div>
			</fieldset>
		</div>
	);
}
