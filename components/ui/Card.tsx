import React from 'react';

type Props = { children: React.ReactNode; className?: string };

export function Card({ children, className = '' }: Props) {
	return <div className={`p-6 rounded-xl bg-gray-900 border border-gray-800 ${className}`}>{children}</div>;
}













