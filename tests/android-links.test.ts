import { describe, expect, it } from 'vitest';
import { androidAssetLinks, parseAndroidFingerprints } from '@/lib/android-links';

describe('Android App Links', () => {
	it('accepts only complete SHA-256 fingerprints', () => {
		const valid = Array.from({ length: 32 }, () => 'ab').join(':');
		expect(parseAndroidFingerprints(`${valid},broken`)).toEqual([valid.toUpperCase()]);
		expect(androidAssetLinks([])).toEqual([]);
		expect(androidAssetLinks([valid])).toMatchObject([
			{ target: { package_name: 'ru.aegisarena.app', sha256_cert_fingerprints: [valid] } }
		]);
	});
});

