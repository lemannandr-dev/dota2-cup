import { afterEach, describe, expect, it, vi } from 'vitest';
import { verifySteamAssertion } from '@/lib/steam';

function assertion() {
	return new URLSearchParams({
		'openid.mode': 'id_res', 'openid.claimed_id': 'https://steamcommunity.com/openid/id/76561198000000001',
		'openid.identity': 'https://steamcommunity.com/openid/id/76561198000000001',
		'openid.op_endpoint': 'https://steamcommunity.com/openid/login',
		'openid.signed': 'claimed_id,identity,return_to,response_nonce,op_endpoint',
		'openid.return_to': 'http://localhost:3002/api/auth/steam/callback?state=abc'
	});
}
afterEach(() => vi.unstubAllGlobals());
describe('Steam assertion binding', () => {
	it('verifies only assertions bound to the exact callback', async () => {
		const fetcher = vi.fn().mockResolvedValue(new Response('is_valid:true'));
		vi.stubGlobal('fetch', fetcher);
		expect(await verifySteamAssertion(assertion(), 'http://localhost:3000/api/auth/steam/callback?state=abc')).toBeNull();
		expect(fetcher).not.toHaveBeenCalled();
		expect(await verifySteamAssertion(assertion(), assertion().get('openid.return_to')!)).toBe('76561198000000001');
		expect(fetcher.mock.calls[0][1].signal).toBeInstanceOf(AbortSignal);
	});
	it('does not accept unsigned return targets', async () => {
		const query = assertion(); query.set('openid.signed', 'claimed_id,identity');
		expect(await verifySteamAssertion(query)).toBeNull();
	});
	it('does not accept a different identity or provider', async () => {
		const query = assertion(); query.set('openid.identity', 'https://evil.test');
		expect(await verifySteamAssertion(query)).toBeNull();
		query.set('openid.identity', query.get('openid.claimed_id')!); query.set('openid.op_endpoint', 'https://evil.test');
		expect(await verifySteamAssertion(query)).toBeNull();
	});
});
