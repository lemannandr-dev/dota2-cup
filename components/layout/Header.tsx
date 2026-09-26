'use client';

import { useEffect, useRef, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { CircleUserRound, Home, Menu, Search, Swords, Trophy, UsersRound, X, type LucideIcon } from 'lucide-react';
import { SteamButton } from '@/components/dota/SteamButton';
import { RankMedal } from '@/components/dota/RankMedal';
import { MmrGlow } from '@/components/dota/MmrGlow';
import { NotificationBell } from '@/components/layout/NotificationBell';
import { ReferralShareButton } from '@/components/layout/ReferralShareButton';
import { PwaInstallControl } from '@/components/pwa/PwaInstallControl';
import { DEFAULT_SITE_APPEARANCE } from '@/lib/site-appearance';
import type { HeaderRankMedal, OpenDotaMmr } from '@/lib/dota-rank';

export type HeaderUser = {
	id: string;
	displayName: string;
	avatarUrl?: string | null;
	medal?: HeaderRankMedal | null;
	mmr?: OpenDotaMmr | null;
};

export function Header({ user, appLogoUrl }: { user: HeaderUser | null; appLogoUrl: string }) {
	const path = usePathname();
	const [open, setOpen] = useState(false);
	const headerRef = useRef<HTMLElement>(null);
	const toggleRef = useRef<HTMLButtonElement>(null);
	const profileHref = user ? `/profile/${user.id}` : '/home';
	const nav = [
		{ href: '/home', label: 'Главная' },
		{ href: '/tournaments', label: 'Турниры' },
		{ href: '/party-search', label: 'Игроки и пати' },
		{ href: '/teams', label: 'Команды' },
		...(user ? [{ href: '/heroes', label: 'Герои' }, { href: profileHref, label: 'Аналитика' }] : [])
	];
	const mobileIcons: Record<string, LucideIcon> = {
		'/home': Home,
		'/tournaments': Trophy,
		'/party-search': Search,
		'/teams': UsersRound,
		'/heroes': Swords,
		...(user ? { [profileHref]: CircleUserRound } : {})
	};

	useEffect(() => {
		setOpen(false);
	}, [path]);
	useEffect(() => {
		if (!open) return;
		function keydown(event: KeyboardEvent) {
			if (event.key === 'Escape') {
				setOpen(false);
				toggleRef.current?.focus();
			}
		}
		function outside(event: PointerEvent) {
			if (!headerRef.current?.contains(event.target as Node)) setOpen(false);
		}
		document.addEventListener('keydown', keydown);
		document.addEventListener('pointerdown', outside);
		return () => {
			document.removeEventListener('keydown', keydown);
			document.removeEventListener('pointerdown', outside);
		};
	}, [open]);

	return (
		<header
			ref={headerRef}
			data-site-header
			className="sticky top-0 z-40 border-b border-line/60 bg-ink/95 pt-[env(safe-area-inset-top)] backdrop-blur-md"
		>
			<div className="mx-auto flex h-14 max-w-shell items-center gap-4 px-4 md:px-6 lg:px-8">
				<div className="flex min-w-0 flex-1 items-center gap-5">
					<Link href="/home" aria-label="Aegis Arena, главная" className="flex shrink-0 items-center">
						<Image
							src={appLogoUrl}
							alt=""
							width={32}
							height={32}
							unoptimized
							className="h-8 w-8 object-contain"
							onError={(event) => {
								if (!event.currentTarget.src.endsWith(DEFAULT_SITE_APPEARANCE.appLogoUrl)) {
									event.currentTarget.src = DEFAULT_SITE_APPEARANCE.appLogoUrl;
								}
							}}
						/>
					</Link>
					<nav aria-label="Разделы арены" className="hidden min-w-0 items-center gap-0.5 lg:flex">
						{nav.map((item) => (
							<Link
								key={item.href}
								href={item.href}
								aria-current={path === item.href ? 'page' : undefined}
								className={`inline-flex min-h-10 items-center rounded-md px-2.5 text-sm transition-colors ${
									path === item.href ? 'bg-white/10 text-cream' : 'text-muted hover:text-cream'
								}`}
							>
								{item.label}
							</Link>
						))}
						{user ? <ReferralShareButton /> : null}
					</nav>
				</div>
				<div className="ml-auto flex shrink-0 items-center gap-2">
					{user && <NotificationBell />}
					{!user && <SteamButton className="max-w-[9.5rem] truncate px-3 text-xs md:hidden" label="Steam" />}
					<div className="hidden md:block">
						{user ? (
							<Link
								href={profileHref}
								aria-label="Мой профиль"
								className="inline-flex min-h-11 items-center gap-2 px-1 text-sm text-cream"
							>
								{user.avatarUrl ? (
									<Image
										src={user.avatarUrl}
										alt=""
										width={32}
										height={32}
										unoptimized
										className="h-8 w-8 shrink-0 rounded-full object-cover"
									/>
								) : null}
								<span className="min-w-0 text-right leading-tight">
									<span className="block max-w-36 truncate">{user.displayName}</span>
									<span className="flex items-center justify-end gap-1 text-[11px] text-radiant">
										<span className="h-1.5 w-1.5 rounded-full bg-radiant" aria-hidden="true" />
										на арене
									</span>
								</span>
								{user.medal ? (
									<RankMedal
										tier={user.medal.tier}
										stars={user.medal.stars}
										leaderboard={user.medal.leaderboard}
										size={22}
										showLabel={false}
									/>
								) : null}
								{user.mmr ? (
									<span className="hidden xl:inline">
										<MmrGlow mmr={user.mmr} size="xs" />
									</span>
								) : null}
							</Link>
						) : (
							<SteamButton />
						)}
					</div>
					<button
						ref={toggleRef}
						type="button"
						aria-label={open ? 'Закрыть меню' : 'Открыть меню'}
						aria-expanded={open}
						aria-controls="arena-mobile-menu"
						onClick={() => setOpen((value) => !value)}
						className="flex h-11 w-11 items-center justify-center rounded-lg border border-line text-cream lg:hidden"
					>
						{open ? <X size={20} aria-hidden="true" /> : <Menu size={20} aria-hidden="true" />}
					</button>
				</div>
			</div>
			<nav
				id="arena-mobile-menu"
				hidden={!open}
				aria-label="Меню арены"
				className="absolute inset-x-0 top-full max-h-[calc(100dvh-9rem-env(safe-area-inset-top)-env(safe-area-inset-bottom))] overflow-y-auto overscroll-contain border-b border-line bg-ink px-4 py-3 shadow-xl lg:hidden"
			>
				{user ? (
					<Link
						href={profileHref}
						onClick={() => setOpen(false)}
						aria-current={path.startsWith('/profile') ? 'page' : undefined}
						aria-label="Мой профиль"
						className="mb-3 flex items-center gap-3 rounded-xl border border-line bg-panel/80 px-3 py-2.5 text-cream"
					>
						{user.avatarUrl ? (
							<Image
								src={user.avatarUrl}
								alt=""
								width={40}
								height={40}
								unoptimized
								className="h-10 w-10 shrink-0 rounded-full object-cover"
							/>
						) : null}
						<span className="min-w-0 flex-1">
							<span className="block truncate text-sm font-semibold">{user.displayName}</span>
							<span className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1">
								<span className="inline-flex items-center gap-1 text-[11px] text-radiant">
									<span className="h-1.5 w-1.5 rounded-full bg-radiant" aria-hidden="true" />
									на арене
								</span>
								{user.medal ? (
									<RankMedal
										tier={user.medal.tier}
										stars={user.medal.stars}
										leaderboard={user.medal.leaderboard}
										size={20}
										showLabel={false}
									/>
								) : null}
								{user.mmr ? <MmrGlow mmr={user.mmr} size="xs" /> : null}
							</span>
						</span>
					</Link>
				) : null}
				<div className="grid grid-cols-2 gap-2">
					{nav.map((item) => {
						const Icon = mobileIcons[item.href] ?? Home;
						const active = item.href === '/home' ? path === '/home' || path === '/' : path === item.href || path.startsWith(`${item.href}/`);
						return (
							<Link
								key={item.href}
								href={item.href}
								onClick={() => setOpen(false)}
								aria-current={active ? 'page' : undefined}
								className={`flex min-h-12 items-center gap-2 rounded-lg border px-3 text-sm ${
									active ? 'border-aegis/50 bg-panel2 text-aegisSoft' : 'border-line/80 text-cream hover:bg-panel2'
								}`}
							>
								<Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
								<span className="min-w-0 truncate">{item.label}</span>
							</Link>
						);
					})}
				</div>
				<div className="mt-3 flex items-center gap-2 border-t border-line pt-3">
					{user ? (
						<ReferralShareButton className="min-w-0 flex-1 [&>button]:w-full [&>button]:justify-center" />
					) : (
						<SteamButton className="min-w-0 flex-1 justify-center" />
					)}
					<PwaInstallControl />
				</div>
			</nav>
		</header>
	);
}
