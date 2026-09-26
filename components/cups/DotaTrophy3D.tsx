'use client';

import { useCallback, useRef } from 'react';
import Image from 'next/image';
import './dota-trophy-3d.css';

export type DotaTrophy3DProps = {
	place?: number | string;
	label?: string;
	subtitle?: string;
	caption?: string;
	accent?: 'ember' | 'radiant' | 'night' | 'void' | 'relic';
	interactive?: boolean;
	autoRotate?: boolean;
	compact?: boolean;
	className?: string;
};

function DotaMark({ className = '' }: { className?: string }) {
	return (
		<svg className={className} viewBox="0 0 100 100" focusable="false" aria-hidden="true">
			<path
				className="trophy3d-dota-lobe"
				d="M24 30c10-18 32-22 44-8 8 10 6 24-6 32-8 6-18 6-24 0 8 2 16-2 18-12 3-12-4-20-16-18-8 2-14 10-16 6z"
			/>
			<path
				className="trophy3d-dota-lobe"
				d="M76 70c-10 18-32 22-44 8-8-10-6-24 6-32 8-6 18-6 24 0-8-2-16 2-18 12-3 12 4 20 16 18 8-2 14-10 16-6z"
			/>
			<path className="trophy3d-dota-river" d="M58 18c10 10 8 22-2 34-8 10-12 20-8 30-12-8-16-22-6-36 8-12 10-20 16-28z" />
		</svg>
	);
}

export function DotaTrophy3D({
	place = 1,
	label = 'PLACE',
	subtitle = 'КИБЕРСПОРТИВНЫЙ ТУРНИР',
	caption = 'среди команд по Dota 2',
	accent = 'ember',
	interactive = true,
	autoRotate = true,
	compact = false,
	className = ''
}: DotaTrophy3DProps) {
	const stageRef = useRef<HTMLDivElement>(null);

	const setTilt = useCallback((rotateX: number, rotateY: number) => {
		const stage = stageRef.current;
		if (!stage) return;
		stage.style.setProperty('--rotate-x', `${rotateX.toFixed(2)}deg`);
		stage.style.setProperty('--rotate-y', `${rotateY.toFixed(2)}deg`);
	}, []);

	const handlePointerMove = useCallback(
		(event: React.PointerEvent<HTMLDivElement>) => {
			if (!interactive || event.pointerType === 'touch') return;
			const bounds = event.currentTarget.getBoundingClientRect();
			const x = (event.clientX - bounds.left) / bounds.width - 0.5;
			const y = (event.clientY - bounds.top) / bounds.height - 0.5;
			event.currentTarget.style.setProperty('--light-x', `${50 + x * 34}%`);
			event.currentTarget.style.setProperty('--light-y', `${44 + y * 30}%`);
			setTilt(y * -12, x * 16);
		},
		[interactive, setTilt]
	);

	const resetTilt = useCallback(() => {
		if (!interactive) return;
		setTilt(-2.5, 0);
	}, [interactive, setTilt]);

	const classes = [
		'trophy3d-stage',
		`trophy3d-${accent}`,
		autoRotate ? 'trophy3d-auto' : '',
		interactive ? 'trophy3d-interactive' : '',
		compact ? 'trophy3d-compact' : '',
		className
	]
		.filter(Boolean)
		.join(' ');

	return (
		<div ref={stageRef} className={classes} onPointerMove={handlePointerMove} onPointerLeave={resetTilt}>
			<div className="trophy3d-light-top" aria-hidden="true" />
			<div className="trophy3d-aura" aria-hidden="true" />
			<div className="trophy3d-light-up" aria-hidden="true" />
			<div className="trophy3d-floor" aria-hidden="true" />

			<div className="trophy3d-model" role="img" aria-label={compact ? `Кубок ${place} места` : `${place} ${label}. ${subtitle}`}>
				<div className="trophy3d-crown" aria-hidden="true">
					<div className="trophy3d-ring trophy3d-ring-back" />
					<div className="trophy3d-ring trophy3d-ring-depth" />
					<div className="trophy3d-ring trophy3d-ring-front">
						<div className="trophy3d-ember-disc" />
						<div className="trophy3d-emblem">
							<Image
								src="/dota2-logo-symbol.png"
								alt=""
								width={96}
								height={96}
								unoptimized
								className="trophy3d-dota-photo"
								onError={(event) => {
									event.currentTarget.style.display = 'none';
									event.currentTarget.nextElementSibling?.classList.add('is-on');
								}}
							/>
							<DotaMark className="trophy3d-dota-fallback" />
						</div>
						{!compact &&
							[1, 2, 3, 4, 5, 6, 7, 8].map((stud) => (
								<span key={stud} className={`trophy3d-stud trophy3d-stud-${stud}`} />
							))}
					</div>
				</div>

				<div className="trophy3d-frame" aria-hidden="true">
					{!compact && (
						<>
							<div className="trophy3d-arm trophy3d-arm-left" />
							<div className="trophy3d-arm trophy3d-arm-right" />
							<div className="trophy3d-core-glow" />
						</>
					)}
					<div className="trophy3d-silver trophy3d-silver-left" />
					<div className="trophy3d-silver trophy3d-silver-right" />
				</div>

				<div className="trophy3d-body">
					<div className="trophy3d-body-layer trophy3d-body-back" aria-hidden="true" />
					<div className="trophy3d-body-layer trophy3d-body-edge" aria-hidden="true" />
					<div className="trophy3d-body-layer trophy3d-body-front">
						<div className="trophy3d-place-number" aria-hidden="true">
							{place}
						</div>
						{!compact && (
							<>
								<div className="trophy3d-place-label" aria-hidden="true">
									{label}
								</div>
								<div className="trophy3d-triangle" aria-hidden="true">
									<span className="trophy3d-triangle-metal" />
									<span className="trophy3d-triangle-core">
										<DotaMark />
									</span>
								</div>
							</>
						)}
					</div>
				</div>

				{!compact && (
					<div className="trophy3d-crest" aria-hidden="true">
						<svg viewBox="0 0 120 120" focusable="false">
							<path className="trophy3d-crest-wing-l" d="M58 52 C28 48 14 70 10 92 c18-10 32-8 42-2-8-14-6-28 6-38z" />
							<path className="trophy3d-crest-wing-r" d="M62 52 C92 48 106 70 110 92 c-18-10-32-8-42-2 8-14 6-28-6-38z" />
							<path className="trophy3d-crest-blade" d="M60 8 l6 38-6 10-6-10z" />
							<circle className="trophy3d-crest-star" cx="60" cy="52" r="10" />
							<path className="trophy3d-crest-star-cut" d="M60 44 l3 6 7 1-5 5 1 7-6-3-6 3 1-7-5-5 7-1z" />
						</svg>
					</div>
				)}

				<div className="trophy3d-base">
					<div className="trophy3d-base-back" aria-hidden="true" />
					<div className="trophy3d-base-top" aria-hidden="true" />
					{!compact && (
						<>
							<div className="trophy3d-base-side trophy3d-base-side-left" aria-hidden="true" />
							<div className="trophy3d-base-side trophy3d-base-side-right" aria-hidden="true" />
						</>
					)}
					<div className="trophy3d-base-front">
						{!compact && (
							<div className="trophy3d-plaque" aria-hidden="true">
								<strong>{subtitle}</strong>
								<span>{caption}</span>
							</div>
						)}
					</div>
				</div>
			</div>
		</div>
	);
}

export function CupGlyph({
	year,
	className = 'h-20 w-16',
	showYear = false,
	title,
	compact = false,
	accent = 'ember',
	subtitle = 'КИБЕРСПОРТИВНЫЙ ТУРНИР',
	caption = 'среди команд по Dota 2'
}: {
	year: number;
	markId?: string;
	className?: string;
	showYear?: boolean;
	title?: string;
	compact?: boolean;
	accent?: 'ember' | 'radiant' | 'night' | 'void' | 'relic';
	subtitle?: string;
	caption?: string;
}) {
	void year;
	void showYear;
	void title;
	return (
		<span className={`trophy3d-slot ${compact ? 'trophy3d-slot-compact' : ''} ${className}`}>
			<DotaTrophy3D
				place={1}
				label="PLACE"
				subtitle={subtitle}
				caption={caption}
				accent={accent}
				autoRotate={!compact}
				interactive={!compact}
				compact={compact}
			/>
		</span>
	);
}
