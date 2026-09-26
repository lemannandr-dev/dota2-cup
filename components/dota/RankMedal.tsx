'use client';

import React, { useState } from 'react';
import Image from 'next/image';
import { rankMedalBases, rankStars, rankLabels, romanStars, type RankTier, type RankStars } from '@/lib/assets';

interface Props {
	tier: RankTier;
	stars?: RankStars;
	leaderboard?: number;
	size?: number;
	showLabel?: boolean;
}

export function RankMedal({ tier, stars, leaderboard, size = 44, showLabel = true }: Props) {
	const [failed, setFailed] = useState(false);
	const label = leaderboard
		? `${rankLabels[tier]} · #${leaderboard}`
		: stars
			? `${rankLabels[tier]} ${romanStars(stars)}`
			: rankLabels[tier];

	return (
		<span className="inline-flex items-center gap-2">
			<span className="relative shrink-0" style={{ width: size, height: size }}>
				{failed ? (
					<span
						aria-hidden="true"
						className="flex items-center justify-center w-full h-full rounded-full bg-panel2 border border-line text-aegis text-xs font-mono"
					>
						{rankLabels[tier].slice(0, 2)}
					</span>
				) : (
					<>
						<Image
							src={rankMedalBases[tier]}
							alt={label}
							width={size}
							height={size}
							unoptimized
							loading="lazy"
							className="h-full w-full object-contain"
							onError={() => setFailed(true)}
						/>
						{stars ? (
							<Image
								src={rankStars[stars]}
								alt=""
								aria-hidden="true"
								width={size}
								height={size}
								unoptimized
								loading="lazy"
								className="absolute inset-0 h-full w-full object-contain"
								onError={() => undefined}
							/>
						) : null}
					</>
				)}
			</span>
			{showLabel && <span className="text-sm text-cream whitespace-nowrap">{label}</span>}
		</span>
	);
}
