import React from 'react';

type Props = React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary' | 'secondary' };

export function Button({ variant = 'primary', className = '', ...rest }: Props) {
	const base = 'inline-flex min-h-12 items-center justify-center rounded-lg px-4 py-2 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-50';
	const styles = variant === 'primary' ? 'aegis-action bg-aegis text-ink hover:bg-aegisSoft' : 'border border-line bg-panel2 text-cream hover:border-aegis/60';
	return <button className={`${base} ${styles} ${className}`} {...rest} />;
}













