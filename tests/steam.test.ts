import { describe, expect, it } from 'vitest';
import { buildSteamLoginUrl, getRequestBaseUrl, resolveSteamBaseUrl } from '@/lib/steam';

describe('Steam OpenID URL', () => {
	it('keeps the browser-facing local port', () => {
		expect(
			resolveSteamBaseUrl(
				'http://localhost:3002/api/auth/steam',
				'http://localhost:3000'
			)
		).toBe('http://localhost:3002');
	});

	it('keeps the configured public origin in production-like requests', () => {
		expect(
			resolveSteamBaseUrl(
				'http://web2:3000/api/auth/steam',
				'https://arena.example.com'
			)
		).toBe('https://arena.example.com');
	});

	it('uses the current local origin for return_to and realm', () => {
		const loginUrl = new URL(
			buildSteamLoginUrl('/api/auth/steam/callback', 'http://localhost:3002/api/auth/steam')
		);

		expect(loginUrl.searchParams.get('openid.return_to')).toBe(
			'http://localhost:3002/api/auth/steam/callback'
		);
		expect(loginUrl.searchParams.get('openid.realm')).toBe('http://localhost:3002');
	});

	it('uses the browser Host header instead of the Docker process port', () => {
		const base = getRequestBaseUrl({
			url: 'http://localhost:3000/api/auth/steam',
			headers: new Headers({ host: 'localhost:3002' })
		});

		expect(base).toBe('http://localhost:3002');
	});
});
