export const DISPUTE_STALE_MINUTES = 60;

export function disputeAgeMinutes(createdAt: Date | string, now = new Date()) {
	const start = typeof createdAt === 'string' ? Date.parse(createdAt) : createdAt.getTime();
	if (Number.isNaN(start)) return 0;
	return Math.max(0, Math.floor((now.getTime() - start) / 60_000));
}

export function disputeSlaLabel(createdAt: Date | string, now = new Date()) {
	const minutes = disputeAgeMinutes(createdAt, now);
	if (minutes < 5) return 'только что';
	if (minutes < 60) return `${minutes} мин`;
	const hours = Math.floor(minutes / 60);
	if (hours < 24) return `${hours} ч`;
	return `${Math.floor(hours / 24)} д`;
}

export function isDisputeStale(createdAt: Date | string, now = new Date()) {
	return disputeAgeMinutes(createdAt, now) >= DISPUTE_STALE_MINUTES;
}
