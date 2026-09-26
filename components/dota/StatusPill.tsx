import React from 'react';

type Tone = 'radiant' | 'dire' | 'info' | 'aegis' | 'muted' | 'wait';

const tones: Record<Tone, string> = {
	radiant: 'text-radiant border-radiant/40 bg-radiant/10',
	dire: 'text-dire border-dire/40 bg-dire/10',
	info: 'text-info border-info/40 bg-info/10',
	aegis: 'text-aegis border-aegis/40 bg-aegis/10',
	wait: 'text-[#F5D76E] border-[#F5D76E]/55 bg-[#F5D76E]/15',
	muted: 'text-muted border-line bg-panel2'
};

interface Props {
	tone?: Tone;
	icon?: React.ReactNode;
	children: React.ReactNode;
	className?: string;
	compact?: boolean;
}

export function StatusPill({ tone = 'muted', icon, children, className = '', compact = false }: Props) {
	return (
		<span
			className={`inline-flex items-center rounded-full border font-medium whitespace-nowrap ${
				compact ? 'gap-1 px-1.5 py-0 text-[10px] leading-5' : 'gap-1.5 px-2.5 py-1 text-xs'
			} ${tones[tone]} ${className}`}
		>
			{icon}
			{children}
		</span>
	);
}
