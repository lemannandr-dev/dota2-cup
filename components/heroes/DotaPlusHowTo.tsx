'use client';

import React, { useState } from 'react';

const steps = [
	{
		title: 'Dota Plus в игре',
		body: 'Подписка должна быть активна в клиенте Dota 2. Без Plus у героев нет официального уровня — на сайте его тоже не будет.'
	},
	{
		title: 'Войдите через Steam',
		body: 'Нажмите «Войти через Steam» на сайте. Пароль Steam, Steam Guard и файлы аккаунта мы не просим и не читаем. Нужен только ваш SteamID, чтобы найти ваши матчи.'
	},
	{
		title: 'Быстрый способ — кнопка на этой странице',
		body: 'Откройте «Герои». Если после последнего снимка были новые катки, сайт сам ставит разбор публичных реплеев Valve. Кнопка «Подтянуть уровни как в игре» — если нужно обновить вручную. Обычно 2–5 минут. Пароль не нужен.'
	},
	{
		title: 'Проверьте бейдж на карточке',
		body: 'У героя появится значок Plus сверху и цифра уровня под ним — как в клиенте. Если значка нет, матчей мало или Valve уже удалила реплей (обычно хранится около двух недель).'
	},
	{
		title: 'Если героя нет — сохраните реплей в Dota',
		body: 'В клиенте: после матча или во вкладке «Просмотр» скачайте игру. Нужен файл .dem в папке replays. Файлы .edem сайт и helper не читают.'
	},
	{
		title: 'Дополнительно — helper с вашего ПК',
		body: 'В профиле нажмите «Получить одноразовый код», скачайте DotaSyncHelper.ps1, откройте PowerShell в папке загрузок и вставьте команду со страницы. После предпросмотра введите yes. Helper читает локальные .dem и кэш Plus, инвентарь на сайт не уходит. Нужен Python 3.'
	}
] as const;

export function DotaPlusHowTo({
	loggedIn,
	profileHref,
	defaultOpen = false
}: {
	loggedIn: boolean;
	profileHref?: string;
	defaultOpen?: boolean;
}) {
	const [open, setOpen] = useState(defaultOpen);

	return (
		<section className="obsidian-glass rounded-card overflow-hidden">
			<button
				type="button"
				onClick={() => setOpen((value) => !value)}
				className="flex w-full items-center justify-between gap-3 px-5 py-4 text-left"
			>
				<div>
					<div className="font-display text-lg text-cream">Как увидеть уровни Dota Plus</div>
					<p className="mt-1 text-sm text-muted">По шагам: что нужно, куда зайти и какую кнопку нажать.</p>
				</div>
				<span className="shrink-0 text-sm text-aegisSoft">{open ? 'Скрыть' : 'Показать'}</span>
			</button>
			{open && (
				<div className="space-y-4 border-t border-line px-5 py-5">
					<ol className="space-y-4">
						{steps.map((step, index) => (
							<li key={step.title} className="flex gap-3">
								<span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-aegis/50 bg-aegis/10 font-mono text-sm text-aegisSoft">
									{index + 1}
								</span>
								<div>
									<div className="font-semibold text-cream">{step.title}</div>
									<p className="mt-1 text-sm leading-relaxed text-muted">{step.body}</p>
								</div>
							</li>
						))}
					</ol>
					<div className="rounded-lg border border-line bg-panel/60 p-4 text-sm text-muted">
						<div className="font-semibold text-cream">Где что находится</div>
						<ul className="mt-2 list-disc space-y-1 pl-5">
							<li>
								Кнопка «Подтянуть уровни как в игре» — на странице{' '}
								<a href="/heroes" className="text-aegisSoft hover:text-aegis">
									Герои
								</a>
								{loggedIn ? ' справа сверху.' : '. Сначала войдите через Steam.'}
							</li>
							<li>
								Код и helper — в{' '}
								{profileHref ? (
									<a href={profileHref} className="text-aegisSoft hover:text-aegis">
										профиле
									</a>
								) : (
									'своём профиле'
								)}
								, блок «Синхронизация Dota 2».
							</li>
							<li>Реплеи в игре: Dota 2 → Просмотр / Watch → скачать матч → файл .dem.</li>
							<li>Папку на сайт указывать не нужно: браузер диск не читает.</li>
						</ul>
					</div>
				</div>
			)}
		</section>
	);
}
