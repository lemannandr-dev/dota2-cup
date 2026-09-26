'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

type Props = {
	profileHref: string;
};

const items = [
	{ id: 'profile', label: 'Профиль', match: (path: string) => path.startsWith('/profile') },
	{ id: 'heroes', label: 'Герои', href: '/heroes', match: (path: string) => path.startsWith('/heroes') },
	{ id: 'balance', label: 'Баланс', href: '/balance', match: (path: string) => path.startsWith('/balance') }
] as const;

/** Shared mobile rail: profile ↔ heroes ↔ balance as one account surface. */
export function PlayerAccountRail({ profileHref }: Props) {
	const path = usePathname() || '';
	return (
		<nav
			aria-label="Аккаунт игрока"
			className="mb-4 flex gap-2 overflow-x-auto pb-1 md:mb-6"
			data-account-rail="true"
		>
			{items.map((item) => {
				const href = item.id === 'profile' ? profileHref : item.href;
				const active = item.match(path);
				return (
					<Link
						key={item.id}
						href={href}
						aria-current={active ? 'page' : undefined}
						className={`inline-flex min-h-11 shrink-0 items-center rounded-lg border px-3 text-sm ${
							active ? 'border-aegis bg-aegis/15 text-aegisSoft' : 'border-line text-muted hover:text-cream'
						}`}
					>
						{item.label}
					</Link>
				);
			})}
		</nav>
	);
}
