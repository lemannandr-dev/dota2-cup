import React from 'react';
import { SteamButton } from '@/components/dota/SteamButton';

const trustCards = [
	{
		title: 'Официальный переход',
		text: 'Перед авторизацией вы видите домен назначения — steamcommunity.com. Никаких промежуточных форм.'
	},
	{
		title: 'Защищённая сессия',
		text: 'Серверные сессии, cookie с флагами Secure, HttpOnly и SameSite. Токены авторизации не хранятся в localStorage.'
	},
	{
		title: 'Активные устройства',
		text: 'Список сессий с устройством и временем входа, отзыв доступа и уведомления о новых входах.'
	},
	{
		title: 'Прозрачные данные',
		text: 'У каждого показателя — источник и время синхронизации. Приватные или недоступные данные помечаются честно.'
	}
];

export function SecuritySection() {
	return (
		<section id="security" className="relative py-20 md:py-28 scroll-mt-20">
			<div
				aria-hidden="true"
				className="absolute inset-0 pointer-events-none"
				style={{
					background:
						'radial-gradient(50% 40% at 50% 30%, rgba(114,167,255,0.06), transparent 65%), radial-gradient(30% 30% at 80% 70%, rgba(216,168,78,0.05), transparent 60%)'
				}}
			/>
			<div className="max-w-shell mx-auto px-4 md:px-6 lg:px-10 relative">
				<p className="text-xs tracking-[0.3em] text-aegis font-mono mb-4">БЕЗОПАСНЫЙ ВХОД</p>
				<h2 className="font-display font-bold uppercase text-3xl md:text-5xl text-cream leading-tight">
					Пароль Steam
					<br />
					остаётся в Steam
				</h2>
				<p className="mt-4 text-muted max-w-2xl">
					Aegis Arena получает подтверждённый SteamID через официальный OpenID-переход. Мы не просим пароль,
					код Steam Guard или резервные коды.
				</p>

				<div className="mt-10 grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-5">
					{trustCards.map((c) => (
						<div key={c.title} className="obsidian-glass rounded-card p-5">
							<h3 className="font-display text-sm text-aegisSoft mb-2">{c.title}</h3>
							<p className="text-sm text-muted leading-relaxed">{c.text}</p>
						</div>
					))}
				</div>

				<div className="mt-6 rounded-card border border-dire/40 bg-dire/5 p-5 flex items-start gap-3">
					<span aria-hidden="true" className="text-dire text-lg leading-none mt-0.5">⚠</span>
					<p className="text-sm text-cream">
						Никому не сообщайте пароль, код Steam Guard или резервные коды. Aegis Arena никогда их не запрашивает.
					</p>
				</div>

				<div className="mt-8 flex flex-col items-start gap-2">
					<SteamButton label="Продолжить через Steam" />
					<span className="text-xs text-muted">Вы будете перенаправлены на steamcommunity.com</span>
				</div>
			</div>
		</section>
	);
}
