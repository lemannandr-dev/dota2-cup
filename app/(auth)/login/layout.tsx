import type { Metadata } from 'next';
import type { ReactNode } from 'react';

export const metadata: Metadata = {
	robots: { index: false, follow: false },
	title: 'Служебный вход'
};

export default function LoginLayout({ children }: { children: ReactNode }) {
	return children;
}
