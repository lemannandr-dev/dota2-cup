'use client';

import type { LucideIcon } from 'lucide-react';
import { CircleUserRound, Home, ListTodo, LogIn, MoreHorizontal, Search, Shield, Swords, Trophy, UsersRound, WalletCards } from 'lucide-react';
import { usePathname } from 'next/navigation';
import { steamLoginHref } from '@/lib/auth-return';
import { useIsClient } from '@/lib/use-is-client';

type Tab = { href: string; label: string; icon: LucideIcon; match: (path: string) => boolean };

export function PlayerTabBar({ userId, isAdmin = false }: { userId: string | null; isAdmin?: boolean }) {
	const ready = useIsClient();
	const path = usePathname() || '';
	if (!ready || path.startsWith('/overlay')) return null;

	const guestTabs: Tab[] = [
		{ href: '/home', label: 'Главная', icon: Home, match: (value) => value === '/' || value === '/home' },
		{ href: '/tournaments', label: 'Кубки', icon: Trophy, match: (value) => value.startsWith('/tournaments') },
		{ href: '/teams', label: 'Команды', icon: UsersRound, match: (value) => value.startsWith('/teams') },
		{ href: '/party-search', label: 'Поиск', icon: Search, match: (value) => value.startsWith('/players') || value.startsWith('/party-search') },
		{ href: '/api/auth/steam', label: 'Войти', icon: LogIn, match: (value) => value.startsWith('/login') }
	];
	const playerTabs: Tab[] = [
		{ href: '/home', label: 'Главная', icon: Home, match: (value) => value === '/home' },
		{ href: '/tournaments', label: 'Кубки', icon: Trophy, match: (value) => value.startsWith('/tournaments') },
		{ href: '/teams?mine=1', label: 'Команда', icon: UsersRound, match: (value) => value.startsWith('/teams') },
		{ href: '/party-search', label: 'Поиск', icon: Search, match: (value) => value.startsWith('/party-search') || value.startsWith('/players') },
		{ href: `/profile/${userId ?? ''}`, label: 'Профиль', icon: CircleUserRound, match: (value) => value.startsWith('/profile') }
	];
	const organizerTabs: Tab[] = [
		{ href: '/admin', label: 'Очередь', icon: ListTodo, match: (value) => value === '/admin' },
		{ href: '/admin/inbox', label: 'Inbox', icon: Swords, match: (value) => value.startsWith('/admin/inbox') || value.startsWith('/admin/matches') || value.startsWith('/admin/disputes') },
		{ href: '/admin/tournaments', label: 'Кубки', icon: Shield, match: (value) => value.startsWith('/admin/tournaments') },
		{ href: '/admin/balance', label: 'Деньги', icon: WalletCards, match: (value) => value.startsWith('/admin/balance') || value.startsWith('/admin/ledger') },
		{ href: '/admin/more', label: 'Ещё', icon: MoreHorizontal, match: (value) => ['/admin/more', '/admin/users', '/admin/teams', '/admin/bonus-codes', '/admin/appearance'].some((prefix) => value.startsWith(prefix)) }
	];
	const tabs = isAdmin && path.startsWith('/admin') ? organizerTabs : userId ? playerTabs : guestTabs;

	return (
		<nav
			data-player-tabbar="true"
			className="mobile-bottom-nav fixed inset-x-0 bottom-0 z-40 border-t border-line/70 bg-ink/95 pb-[env(safe-area-inset-bottom)] backdrop-blur-md md:hidden"
			aria-label={tabs === organizerTabs ? 'Навигация организатора' : userId ? 'Навигация игрока' : 'Основная навигация'}
		>
			<ul className="mx-auto grid max-w-shell grid-cols-5">
				{tabs.map((tab) => {
					const active = tab.match(path);
					const Icon = tab.icon;
					return (
						<li key={tab.href}>
							<a
								href={tab.href}
								onClick={tab.href === '/api/auth/steam' ? (event) => {
									event.currentTarget.href = steamLoginHref(`${window.location.pathname}${window.location.search}${window.location.hash}`);
								} : undefined}
								aria-current={active ? 'page' : undefined}
								className={`mobile-tab relative flex min-h-[60px] flex-col items-center justify-center gap-0.5 px-1 text-[10px] transition-colors ${active ? 'is-active text-aegisSoft' : 'text-muted active:text-cream'}`}
							>
								<span className={`absolute top-0 h-0.5 w-7 rounded-b bg-aegis transition-transform ${active ? 'scale-x-100' : 'scale-x-0'}`} aria-hidden="true" />
								<span className="mobile-tab-icon inline-flex h-7 w-8 items-center justify-center">
									<Icon className="h-5 w-5" strokeWidth={active ? 2.2 : 1.7} aria-hidden="true" />
								</span>
								<span className="max-w-full truncate">{tab.label}</span>
							</a>
						</li>
					);
				})}
			</ul>
		</nav>
	);
}
