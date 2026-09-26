#!/usr/bin/env node
/**
 * Print SHA-256 fingerprint for Android App Links (ANDROID_APP_SHA256).
 *
 * Usage:
 *   node scripts/print-android-sha256.mjs path\to\upload-keystore.jks alias
 *
 * Requires keytool on PATH (JDK 17).
 */
import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';

const [, , keystoreArg, aliasArg] = process.argv;
if (!keystoreArg || !aliasArg) {
	console.error('Usage: node scripts/print-android-sha256.mjs <keystore.jks|.keystore> <alias>');
	process.exit(1);
}

const keystore = resolve(keystoreArg);
const result = spawnSync(
	'keytool',
	['-list', '-v', '-keystore', keystore, '-alias', aliasArg],
	{ encoding: 'utf8' }
);

if (result.status !== 0) {
	console.error(result.stderr || result.stdout || 'keytool failed');
	process.exit(result.status ?? 1);
}

const match = result.stdout.match(/SHA256:\s*([0-9A-Fa-f:]+)/);
if (!match) {
	console.error('SHA256 fingerprint not found in keytool output');
	process.exit(1);
}

const fingerprint = match[1].replace(/:/g, '').toUpperCase();
console.log(fingerprint);
console.log('');
console.log('Add to web env:');
console.log(`ANDROID_APP_SHA256=${fingerprint}`);
console.log('Verify: GET https://<domain>/.well-known/assetlinks.json');
