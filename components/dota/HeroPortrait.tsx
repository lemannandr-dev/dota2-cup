'use client';

import React, { useState } from 'react';
import Image from 'next/image';
import { heroPortraits, heroLabels, type HeroKey } from '@/lib/assets';

interface Props {
	hero: HeroKey;
	size?: number;
	rounded?: string;
}

export function HeroPortrait({ hero, size = 32, rounded = 'rounded-md' }: Props) {
	const [failed, setFailed] = useState(false);
	const label = heroLabels[hero];

	if (failed) {
		return (
			<span
				title={label}
				className={`flex items-center justify-center bg-panel2 border border-line text-muted text-[10px] font-mono ${rounded}`}
				style={{ width: size, height: size * 0.56 }}
			>
				{label.split(' ').map((w) => w[0]).join('')}
			</span>
		);
	}

	return (
		<Image
			src={heroPortraits[hero]}
			alt={label}
			title={label}
			width={size}
			height={Math.round(size * 0.56)}
			loading="lazy"
			className={`object-cover border border-line ${rounded}`}
			style={{ width: size, height: size * 0.56 }}
			onError={() => setFailed(true)}
		/>
	);
}
