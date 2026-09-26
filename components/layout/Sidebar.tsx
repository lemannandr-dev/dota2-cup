import React from 'react';
import Link from 'next/link';

export function Sidebar() {
	return (
		<aside className="hidden lg:block w-64 border-r border-gray-800 p-4">
			<nav className="space-y-2 text-sm">
				<a href="/teams" className="block hover:text-white text-gray-300">Команды</a>
				<Link href="/tournaments" className="block hover:text-white text-gray-300">Турниры</Link>
				<a href="/balance" className="block hover:text-white text-gray-300">Баланс</a>
			</nav>
		</aside>
	);
}













