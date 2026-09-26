'use client';

import { useIsClient } from '@/lib/use-is-client';

const columns = [
	{
		title: 'Продукт',
		links: [
			{ label: 'Турниры', href: '/tournaments' },
			{ label: 'Игроки и пати', href: '/party-search' },
			{ label: 'Герои', href: '/heroes' }
		]
	},
	{
		title: 'Организаторам',
		links: [
			{ label: 'Команды', href: '/teams' },
			{ label: 'Турниры', href: '/tournaments' },
			{ label: 'Баланс', href: '/balance' },
			{ label: 'Правовое', href: '/legal' }
		]
	},
	{
		title: 'Безопасность',
		links: [
			{ label: 'Приватность', href: '/legal#privacy' },
			{ label: 'Сессии', href: '/legal#sessions' },
			{ label: 'Пожаловаться', href: '/legal#report' },
			{ label: 'Безопасность', href: '/legal#security' }
		]
	},
	{
		title: 'Правовое',
		links: [
			{ label: 'Условия', href: '/legal' },
			{ label: 'Источники данных', href: '/legal#sources' },
			{ label: 'Товарные знаки', href: '/legal#marks' }
		]
	}
];

export function Footer() {
	const ready = useIsClient();
	if (!ready) {
		return <footer className="mt-24 border-t border-line/60" aria-hidden="true" />;
	}

	return (
		<footer className="mt-24 border-t border-line/60">
			<div className="mx-auto max-w-shell px-4 py-12 md:px-6 lg:px-10">
				<div className="grid grid-cols-2 gap-8 md:grid-cols-4">
					{columns.map((col) => (
						<div key={col.title}>
							<div className="mb-3 font-display text-sm text-cream">{col.title}</div>
							<ul className="space-y-2">
								{col.links.map((l) => (
									<li key={l.label}>
										<a href={l.href} className="text-sm text-muted transition-colors hover:text-cream">
											{l.label}
										</a>
									</li>
								))}
							</ul>
						</div>
					))}
				</div>
				<p className="mt-10 border-t border-line/40 pt-6 text-xs leading-relaxed text-muted">
					Aegis Arena — независимая платформа сообщества. Проект не связан с Valve Corporation и не одобрен ею. Dota 2, Steam и
					соответствующие логотипы являются товарными знаками Valve Corporation.
				</p>
			</div>
		</footer>
	);
}
