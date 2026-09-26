import { formatOpenDotaMmr, type OpenDotaMmr } from '@/lib/dota-rank';

export function MmrGlow({ mmr, size = 'sm' }: { mmr: OpenDotaMmr; size?: 'xs' | 'sm' | 'md' }) {
	return (
		<span
			title={formatOpenDotaMmr(mmr)}
			className={`mmr-glow inline-flex items-baseline gap-1.5 ${size === 'md' ? 'mmr-glow-md' : ''} ${size === 'xs' ? 'mmr-glow-xs' : ''}`}
		>
			<span className="mmr-glow-label">MMR</span>
			<span className="mmr-glow-value">{mmr.value}</span>
		</span>
	);
}
