import { getRequestBaseUrl } from '@/lib/steam';
import { DomainError } from '@/server/errors';

/** Block cross-site cookie-authenticated POSTs/PUTs that omit or spoof Origin. */
export function assertSameOriginMutation(req: Request) {
	const origin = req.headers.get('origin');
	if (!origin || origin !== getRequestBaseUrl(req)) {
		throw new DomainError('Запрос с другого сайта запрещён.', 403);
	}
}

const IDEMPOTENCY_KEY_RE = /^[\w.:-]{8,128}$/;

/** Optional client retry key; invalid values are ignored (request still runs once). */
export function readIdempotencyKey(req: Request): string | null {
	const raw = req.headers.get('idempotency-key')?.trim() ?? '';
	if (!raw || !IDEMPOTENCY_KEY_RE.test(raw)) return null;
	return raw;
}
