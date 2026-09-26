import React from 'react';

type Props = React.InputHTMLAttributes<HTMLInputElement>;

export function Input({ className = '', ...rest }: Props) {
	return <input className={`w-full px-3 py-2 rounded bg-gray-900 border border-gray-800 ${className}`} {...rest} />;
}













