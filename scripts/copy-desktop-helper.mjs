import { copyFileSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const files = ['DotaSyncHelper.ps1', 'DotaSyncHelper.cmd', 'read-replay-plus.py'];
const publicDir = path.join(root, 'public');
mkdirSync(publicDir, { recursive: true });

for (const name of files) {
	copyFileSync(path.join(root, 'desktop-helper', name), path.join(publicDir, name));
}

const helper = readFileSync(path.join(root, 'desktop-helper', 'DotaSyncHelper.ps1'), 'utf8');
const match = helper.match(/helperVersion\s*=\s*'([^']+)'/);
const version = match?.[1] ?? 'unknown';
writeFileSync(
	path.join(publicDir, 'helper-version.json'),
	`${JSON.stringify({ version, files }, null, 2)}\n`
);
console.log(`copied desktop-helper → public (${version})`);
