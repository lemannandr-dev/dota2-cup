export const REFERRAL_COOKIE = 'aegis_ref';
export const REFERRAL_CODE_RE = /^[a-z2-9]{8}$/;

const ALPHABET = 'abcdefghjkmnpqrstuvwxyz2345679';

export type ReferralMilestoneView = {
	id: string;
	threshold: number;
	amountKopecks: number;
	label: string;
	isActive: boolean;
};

export function isReferralCode(value: string) {
	return REFERRAL_CODE_RE.test(value);
}

export function referralCodeFromBytes(bytes: Uint8Array) {
	let code = '';
	for (let i = 0; i < 8; i += 1) code += ALPHABET[(bytes[i] ?? 0) % ALPHABET.length];
	return code;
}

export function referralShareUrl(origin: string, code: string) {
	const base = origin.replace(/\/$/, '');
	return `${base}/?ref=${code}`;
}

export function dueReferralMilestones<T extends ReferralMilestoneView>(count: number, milestones: T[], paidIds: Set<string>) {
	return milestones
		.filter((row) => row.isActive && row.threshold <= count && row.amountKopecks > 0 && !paidIds.has(row.id))
		.sort((a, b) => a.threshold - b.threshold);
}

export function nextReferralMilestone<T extends ReferralMilestoneView>(count: number, milestones: T[]) {
	return (
		milestones
			.filter((row) => row.isActive && row.threshold > count)
			.sort((a, b) => a.threshold - b.threshold)[0] ?? null
	);
}
