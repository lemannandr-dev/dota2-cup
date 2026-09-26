'use client';

import React, { useEffect, useRef, useState, type ReactNode } from 'react';
import { usePathname } from 'next/navigation';
import { PlayerAccountRail } from '@/components/layout/PlayerAccountRail';

export type ProfilePanelId = 'overview' | 'plus' | 'twitch' | 'opendota' | 'guild';

type MenuItem = {
	id: string;
	label: string;
	hint: string;
	panel?: ProfilePanelId;
	href?: string;
};

const PANEL_ITEMS: MenuItem[] = [
	{ id: 'overview', label: 'Обзор', hint: 'Карточка и краткие цифры', panel: 'overview' },
	{ id: 'plus', label: 'Plus и helper', hint: 'Официальный XP и одноразовый код', panel: 'plus' },
	{ id: 'twitch', label: 'Эфир Twitch', hint: 'Канал для окна на главной', panel: 'twitch' },
	{ id: 'opendota', label: 'Статистика OpenDota', hint: 'Медаль и матчи — не рейтинг арены', panel: 'opendota' }
];

const LINK_ITEMS: MenuItem[] = [
	{ id: 'heroes', label: 'Герои', hint: 'Карточки и подтянуть уровни', href: '/heroes' },
	{ id: 'balance', label: 'Баланс', hint: 'Кошелёк арены', href: '/balance' }
];

const PANELS = new Set<ProfilePanelId>(['overview', 'plus', 'twitch', 'opendota', 'guild']);

function panelFromHash(): ProfilePanelId {
	if (typeof window === 'undefined') return 'overview';
	const hash = window.location.hash.replace('#', '') as ProfilePanelId;
	return PANELS.has(hash) ? hash : 'overview';
}

export function ProfileDesk({
	identity,
	tiles,
	overview,
	plus,
	twitch,
	opendota,
	guild
}: {
	identity: ReactNode;
	tiles: Array<{ label: string; value: string; hint: string; panel?: ProfilePanelId; href?: string }>;
	overview: ReactNode;
	plus: ReactNode;
	twitch: ReactNode;
	opendota: ReactNode;
	guild?: ReactNode;
}) {
	const path = usePathname() || '/profile';
	const [panel, setPanel] = useState<ProfilePanelId>('overview');
	const [menu, setMenu] = useState<{ x: number; y: number } | null>(null);
	const chosenPanel = useRef<ProfilePanelId | null>(null);
	const items = [
		...PANEL_ITEMS,
		...(guild ? [{ id: 'guild', label: 'Гильдия', hint: 'Только снимок GC', panel: 'guild' as const }] : []),
		...LINK_ITEMS
	];

	useEffect(() => {
		if (!chosenPanel.current) setPanel(panelFromHash());
		function onHash() {
			if (chosenPanel.current) return;
			setPanel(panelFromHash());
		}
		window.addEventListener('hashchange', onHash);
		return () => window.removeEventListener('hashchange', onHash);
	}, []);

	useEffect(() => {
		if (!menu) return;
		function close() {
			setMenu(null);
		}
		function onKey(event: KeyboardEvent) {
			if (event.key === 'Escape') close();
		}
		function onPointerDown(event: PointerEvent) {
			const node = event.target as Node | null;
			if (node && document.getElementById('profile-desk-menu')?.contains(node)) return;
			if (node && (event.target as HTMLElement | null)?.closest?.('[aria-label="Действия профиля"]')) return;
			close();
		}
		window.addEventListener('pointerdown', onPointerDown);
		window.addEventListener('keydown', onKey);
		window.addEventListener('scroll', close, true);
		return () => {
			window.removeEventListener('pointerdown', onPointerDown);
			window.removeEventListener('keydown', onKey);
			window.removeEventListener('scroll', close, true);
		};
	}, [menu]);

	function openPanel(next: ProfilePanelId) {
		chosenPanel.current = next;
		setPanel(next);
		setMenu(null);
		const url = next === 'overview' ? window.location.pathname : `${window.location.pathname}#${next}`;
		window.history.replaceState(null, '', url);
	}

	function openMenu(event: React.MouseEvent) {
		event.preventDefault();
		event.stopPropagation();
		const width = 248;
		const height = 360;
		setMenu({
			x: Math.min(event.clientX, window.innerWidth - width),
			y: Math.min(event.clientY, window.innerHeight - height)
		});
	}

	const body =
		panel === 'plus' ? plus : panel === 'twitch' ? twitch : panel === 'opendota' ? opendota : panel === 'guild' ? guild : overview;

	return (
		<div className="space-y-4" data-profile-desk="true">
			<PlayerAccountRail profileHref={path.split('#')[0] || path} />
			<section
				onContextMenu={openMenu}
				className="obsidian-glass rounded-card p-5"
				title="Правый клик открывает действия профиля"
			>
				<div className="flex items-start justify-between gap-3">
					<div className="min-w-0 flex-1">{identity}</div>
					<button
						type="button"
						onClick={(event) => {
							event.stopPropagation();
							const rect = event.currentTarget.getBoundingClientRect();
							setMenu((current) =>
								current
									? null
									: {
											x: Math.min(rect.right - 240, window.innerWidth - 248),
											y: Math.min(rect.bottom + 6, window.innerHeight - 360)
										}
							);
						}}
						className="shrink-0 rounded-lg border border-line px-2.5 py-1 text-sm text-muted hover:text-cream"
						aria-label="Действия профиля"
						aria-expanded={Boolean(menu)}
					>
						⋯
					</button>
				</div>
				<div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-4">
					{tiles.map((tile) => (
						<div key={tile.label} className="rounded-xl border border-line bg-black/20 px-3 py-2">
							<div className="text-[10px] uppercase tracking-wide text-muted">{tile.label}</div>
							<div className="mt-0.5 truncate text-sm text-cream">{tile.value}</div>
							{tile.href ? (
								<a href={tile.href} className="mt-1 inline-block text-[11px] text-aegisSoft hover:text-aegis">
									{tile.hint}
								</a>
							) : tile.panel ? (
								<button type="button" onClick={() => openPanel(tile.panel!)} className="mt-1 text-[11px] text-aegisSoft hover:text-aegis">
									{tile.hint}
								</button>
							) : (
								<p className="mt-1 text-[11px] text-muted">{tile.hint}</p>
							)}
						</div>
					))}
				</div>
				<p className="mt-3 text-xs text-muted">Правый клик или ⋯ — Plus, эфир, helper и статистика. На обзоре только короткое резюме.</p>
				<div className="mt-3 flex flex-wrap gap-2">
					{items
						.filter((item) => item.panel)
						.map((item) => (
							<button
								key={item.id}
								type="button"
								data-profile-chip={item.panel}
								onClick={() => openPanel(item.panel!)}
								className={`rounded-full border px-3 py-1.5 text-xs transition ${
									panel === item.panel ? 'border-aegis bg-aegis/10 text-aegisSoft' : 'border-line text-muted hover:text-cream'
								}`}
							>
								{item.label}
							</button>
						))}
					{LINK_ITEMS.map((item) => (
						<a key={item.id} href={item.href} className="rounded-full border border-line px-3 py-1.5 text-xs text-muted hover:text-cream">
							{item.label}
						</a>
					))}
				</div>
			</section>

			<div className="min-h-0" data-profile-body={panel}>
				{body}
			</div>

			{menu && (
				<div
					id="profile-desk-menu"
					className="fixed z-50 min-w-[220px] overflow-hidden rounded-xl border border-line bg-ink/95 p-1 shadow-2xl"
					style={{ left: menu.x, top: menu.y }}
					onClick={(event) => event.stopPropagation()}
					onContextMenu={(event) => event.preventDefault()}
				>
					<div className="px-3 py-2 text-[10px] uppercase tracking-wide text-muted">Действия профиля</div>
					{items.map((item) =>
						item.href ? (
							<a
								key={item.id}
								href={item.href}
								className="flex w-full flex-col items-start rounded-lg px-3 py-2 text-left hover:bg-aegis/10"
							>
								<span className="text-sm text-cream">{item.label}</span>
								<span className="text-[11px] text-muted">{item.hint}</span>
							</a>
						) : (
							<button
								key={item.id}
								type="button"
								onClick={() => item.panel && openPanel(item.panel)}
								className="flex w-full flex-col items-start rounded-lg px-3 py-2 text-left hover:bg-aegis/10"
							>
								<span className="text-sm text-cream">{item.label}</span>
								<span className="text-[11px] text-muted">{item.hint}</span>
							</button>
						)
					)}
				</div>
			)}
		</div>
	);
}
