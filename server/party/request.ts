import { getRequestBaseUrl } from '@/lib/steam';
import { DomainError } from '@/server/errors';

export function assertPartyOrigin(req: Request) {
	if (req.headers.get('origin') !== getRequestBaseUrl(req)) throw new DomainError('Запрос с другого сайта запрещён.', 403);
}

export function partyError(error: unknown) {
	if (error instanceof DomainError) return Response.json({ error: error.message }, { status: error.status });
	console.error('[party]', error);
	return Response.json({ error: 'Не удалось обновить пати. Повторите попытку.' }, { status: 500 });
}
