'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useCallback, useLayoutEffect, useRef, useState } from 'react';

export function HeaderNav({
	items,
	className
}: {
	items: { href: string; label: string }[];
	className?: string;
}) {
	const path = usePathname() || '';
	const router = useRouter();
	const navRef = useRef<HTMLElement>(null);
	const itemRefs = useRef<Array<HTMLAnchorElement | null>>([]);
	const [runner, setRunner] = useState({ left: 0, width: 0, ready: false });

	const isActive = useCallback((href: string) => {
		if (href === '/') return path === '/';
		return path === href || path.startsWith(`${href}/`);
	}, [path]);

	useLayoutEffect(() => {
		const nav = navRef.current;
		const index = items.findIndex((item) => isActive(item.href));
		const el = itemRefs.current[index];
		if (!nav || !el) {
			setRunner((current) => ({ ...current, ready: false }));
			return;
		}
		setRunner({
			left: el.offsetLeft,
			width: el.offsetWidth,
			ready: true
		});
	}, [isActive, items]);

	return (
		<nav ref={navRef} className={`header-nav ${className ?? ''}`} aria-label="Разделы арены">
			<span
				aria-hidden
				className={`header-nav-runner ${runner.ready ? 'is-on' : ''}`}
				style={{ transform: `translateX(${runner.left}px)`, width: runner.width }}
			/>
			{items.map((item, index) => {
				const active = isActive(item.href);
				const className = `header-nav-link ${active ? 'is-active' : ''}`;
				if (item.href === '/home') {
					return (
						<a
							key={item.href}
							ref={(node) => {
								itemRefs.current[index] = node;
							}}
							href="/home"
							onClick={(event) => {
								event.preventDefault();
								router.push('/home');
							}}
							className={className}
						>
							{item.label}
						</a>
					);
				}
				return (
					<Link
						key={item.href}
						ref={(node) => {
							itemRefs.current[index] = node;
						}}
						href={item.href}
						prefetch
						className={className}
					>
						{item.label}
					</Link>
				);
			})}
		</nav>
	);
}
