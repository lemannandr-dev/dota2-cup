export const ANDROID_PACKAGE_NAME = 'ru.aegisarena.app';

export function parseAndroidFingerprints(value?: string | null) {
	return (value ?? '')
		.split(',')
		.map((item) => item.trim().toUpperCase())
		.filter((item) => /^(?:[0-9A-F]{2}:){31}[0-9A-F]{2}$/.test(item));
}

export function androidAssetLinks(fingerprints: string[], packageName = ANDROID_PACKAGE_NAME) {
	if (fingerprints.length === 0) return [];
	return [
		{
			relation: ['delegate_permission/common.handle_all_urls'],
			target: {
				namespace: 'android_app',
				package_name: packageName,
				sha256_cert_fingerprints: fingerprints
			}
		}
	];
}

