#!/usr/bin/env node
/**
 * Generate VAPID keys for Web Push.
 *   node scripts/generate-vapid.mjs           → print to stdout
 *   node scripts/generate-vapid.mjs --write   → upsert into ./.env (local stand)
 */
import fs from 'node:fs';
import path from 'node:path';
import webpush from 'web-push';

const write = process.argv.includes('--write');
const keys = webpush.generateVAPIDKeys();
const lines = [
	`NEXT_PUBLIC_VAPID_PUBLIC_KEY=${keys.publicKey}`,
	`VAPID_PUBLIC_KEY=${keys.publicKey}`,
	`VAPID_PRIVATE_KEY=${keys.privateKey}`,
	'VAPID_SUBJECT=mailto:security@localhost'
];

if (!write) {
	process.stdout.write(`${lines.join('\n')}\n`);
	process.exit(0);
}

const envPath = path.resolve(process.cwd(), '.env');
let text = fs.existsSync(envPath) ? fs.readFileSync(envPath, 'utf8') : '';
for (const line of lines) {
	const eq = line.indexOf('=');
	const key = line.slice(0, eq);
	const value = line.slice(eq + 1);
	const re = new RegExp(`^${key}=.*$`, 'm');
	if (re.test(text)) text = text.replace(re, `${key}=${value}`);
	else text = `${text.trimEnd()}\n${key}=${value}\n`;
}
fs.writeFileSync(envPath, text.endsWith('\n') ? text : `${text}\n`);
process.stdout.write('vapid_written=ok\n');
