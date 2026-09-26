import { timingSafeEqual } from 'crypto';

export function bearerMatches(providedHeader: string | null, expectedToken: string | undefined): boolean {
	if (!expectedToken || !providedHeader?.startsWith('Bearer ')) return false;
	const provided = providedHeader.slice('Bearer '.length);
	const expectedBuf = Buffer.from(expectedToken);
	const providedBuf = Buffer.from(provided);
	if (expectedBuf.length !== providedBuf.length) return false;
	return timingSafeEqual(expectedBuf, providedBuf);
}
