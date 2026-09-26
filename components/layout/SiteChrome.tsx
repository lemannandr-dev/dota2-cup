'use client';

import React from 'react';
import { usePathname } from 'next/navigation';

export function SiteChrome({ children, dock }: { children: React.ReactNode; dock?: 'header' | 'footer' }) {
	const path = usePathname();
	if (path.startsWith('/overlay')) return null;
	if (dock === 'footer') return <div className="hidden md:block">{children}</div>;
	return <>{children}</>;
}
