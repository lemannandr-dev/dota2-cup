'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const links = [
	{ href: '/admin', label: 'Обзор' },
	{ href: '/admin/inbox', label: 'Inbox' },
	{ href: '/admin/users', label: 'Игроки' },
	{ href: '/admin/balance', label: 'Баланс' },
	{ href: '/admin/tournaments', label: 'Кубки' },
	{ href: '/admin/matches', label: 'Пары' },
	{ href: '/admin/disputes', label: 'Споры' },
	{ href: '/admin/teams', label: 'Команды' },
	{ href: '/admin/bonus-codes', label: 'Коды' },
	{ href: '/admin/referrals', label: 'Рефералка' },
	{ href: '/admin/ledger', label: 'Журнал' },
	{ href: '/admin/appearance', label: 'Оформление' }
];

export function AdminNav() {
	const path = usePathname() || '';
	return (
		<nav
			aria-label="Разделы штаба"
			className="-mx-1 flex gap-1 overflow-x-auto overscroll-x-contain rounded-lg border border-line/60 bg-panel/70 p-1 md:flex-wrap"
		>
			{links.map((item) => {
				const active = item.href === '/admin' ? path === '/admin' : path.startsWith(item.href);
				return (
					<Link
						key={item.href}
						href={item.href}
						className={
							active
								? 'inline-flex min-h-11 shrink-0 items-center rounded-lg bg-aegis px-3 text-sm text-ink'
								: 'inline-flex min-h-11 shrink-0 items-center rounded-lg px-3 text-sm text-muted hover:text-cream'
						}
					>
						{item.label}
					</Link>
				);
			})}
		</nav>
	);
}
