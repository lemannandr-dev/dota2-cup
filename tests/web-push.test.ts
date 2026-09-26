import { describe, expect, it } from 'vitest';
import { buildWebPushJson } from '@/lib/web-push-payload';

describe('buildWebPushJson', () => {
	it('keeps relative arena urls for the service worker', () => {
		const parsed = JSON.parse(
			buildWebPushJson({
				title: 'Готовность',
				body: 'Капитан, ответьте на карточке кубка',
				url: '/tournaments/abc#match-1'
			})
		);
		expect(parsed.title).toBe('Готовность');
		expect(parsed.url).toBe('/tournaments/abc#match-1');
	});

	it('falls back to /home for unsafe urls', () => {
		const parsed = JSON.parse(
			buildWebPushJson({
				title: 'Aegis',
				body: 'ping',
				url: 'https://evil.example'
			})
		);
		expect(parsed.url).toBe('/home');
	});
});
