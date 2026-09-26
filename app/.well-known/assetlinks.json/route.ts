import { androidAssetLinks, ANDROID_PACKAGE_NAME, parseAndroidFingerprints } from '@/lib/android-links';

export const dynamic = 'force-dynamic';

export function GET() {
	const fingerprints = parseAndroidFingerprints(process.env.ANDROID_APP_SHA256);
	const packageName = process.env.ANDROID_PACKAGE_NAME?.trim() || ANDROID_PACKAGE_NAME;
	return Response.json(androidAssetLinks(fingerprints, packageName), {
		headers: { 'Cache-Control': 'public, max-age=300' }
	});
}

