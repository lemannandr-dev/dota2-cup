import type { AtmosphereTone } from '@/lib/atmosphere';

export function AtmosphereWash({
	tone,
	soft = false
}: {
	tone: AtmosphereTone;
	/** Landing hero — lower opacity so the display title stays readable. */
	soft?: boolean;
}) {
	return <div aria-hidden="true" className={`atmosphere atmosphere-${tone}${soft ? ' atmosphere-soft' : ''}`} />;
}
