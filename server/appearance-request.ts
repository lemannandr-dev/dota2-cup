import { getRequestBaseUrl } from '@/lib/steam';
import { DomainError } from '@/server/errors';

export function isSameOriginAppearanceRequest(request: Request) {
	const origin = request.headers.get('origin');
	return Boolean(origin && origin === getRequestBaseUrl(request));
}

export async function readAppearanceBody(request: Request, limit: number) {
	if (Number(request.headers.get('content-length')) > limit) throw new DomainError('Файл слишком большой', 413);
	if (!request.body) throw new DomainError('Пустой запрос');
	const reader = request.body.getReader();
	const chunks: Uint8Array[] = [];
	let length = 0;
	try {
		while (true) {
			const { done, value } = await reader.read();
			if (done) break;
			length += value.byteLength;
			if (length > limit) {
				await reader.cancel();
				throw new DomainError('Файл слишком большой', 413);
			}
			chunks.push(value);
		}
	} finally { reader.releaseLock(); }
	return Buffer.concat(chunks);
}
