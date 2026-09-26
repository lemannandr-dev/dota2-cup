export const ADMIN_REFERRAL_FILTERS = ['all', 'invited', 'joined', 'nocode', 'paid'] as const;
export type AdminReferralFilter = (typeof ADMIN_REFERRAL_FILTERS)[number];

export type AdminReferralGuest = {
	id: string;
	displayName: string;
	avatarUrl?: string | null;
	createdAt: string;
};

export type AdminReferralUser = {
	id: string;
	displayName: string;
	avatarUrl?: string | null;
	steamId?: string | null;
	referralCode?: string | null;
	invitedBy?: { id: string; displayName: string } | null;
	accepted: AdminReferralGuest[];
	paidLabels: string[];
};

export type AdminReferralStep = {
	threshold: number;
	isActive: boolean;
	label: string;
};

export function isAdminReferralFilter(value: string | null): value is AdminReferralFilter {
	return ADMIN_REFERRAL_FILTERS.some((row) => row === value);
}

export function adminReferralPasses(user: AdminReferralUser, filter: AdminReferralFilter, q = '') {
	const needle = q.trim().toLowerCase();
	const haystack = [user.displayName, user.steamId, user.referralCode, user.invitedBy?.displayName, ...user.accepted.map((guest) => guest.displayName)]
		.filter(Boolean)
		.join(' ')
		.toLowerCase();
	if (needle && !haystack.includes(needle)) return false;
	if (filter === 'invited') return user.accepted.length > 0;
	if (filter === 'joined') return Boolean(user.invitedBy);
	if (filter === 'nocode') return !user.referralCode;
	if (filter === 'paid') return user.paidLabels.length > 0;
	return true;
}

export function adminReferralCounts(users: AdminReferralUser[]) {
	return {
		all: users.length,
		invited: users.filter((user) => user.accepted.length > 0).length,
		joined: users.filter((user) => Boolean(user.invitedBy)).length,
		nocode: users.filter((user) => !user.referralCode).length,
		paid: users.filter((user) => user.paidLabels.length > 0).length,
		invites: users.reduce((sum, user) => sum + user.accepted.length, 0)
	};
}

export function sortAdminReferrals(users: AdminReferralUser[]) {
	return [...users].sort(
		(a, b) => b.accepted.length - a.accepted.length || a.displayName.localeCompare(b.displayName, 'ru')
	);
}

export function adminReferralProgress(count: number, steps: AdminReferralStep[]) {
	const active = steps.filter((step) => step.isActive).sort((a, b) => a.threshold - b.threshold);
	const next = active.find((step) => step.threshold > count) ?? null;
	const reached = active.filter((step) => step.threshold <= count).length;
	if (!next) {
		return { next: null, reached, remaining: 0, ratio: active.length > 0 ? 1 : 0 };
	}
	return {
		next,
		reached,
		remaining: next.threshold - count,
		ratio: Math.min(1, count / next.threshold)
	};
}
