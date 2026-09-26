#!/usr/bin/env node
/**
 * Snapshot Postgres from the second Docker stack into ./backups/
 *   npm run db:backup
 */
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const container = process.env.AEGIS_PG_CONTAINER || 'media-game-cup-postgres-3';
const database = process.env.AEGIS_PG_DATABASE || 'mediagame';
const user = process.env.AEGIS_PG_USER || 'postgres';
const outDir = path.resolve(process.cwd(), 'backups');
fs.mkdirSync(outDir, { recursive: true });

const stamp = new Date().toISOString().replace(/[:.]/g, '-');
const outFile = path.join(outDir, `mediagame-${stamp}.sql`);

const dump = execFileSync(
	'docker',
	['exec', container, 'pg_dump', '-U', user, '-d', database, '--no-owner', '--no-acl'],
	{ encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 }
);
fs.writeFileSync(outFile, dump);
const latest = path.join(outDir, 'mediagame-latest.sql');
fs.copyFileSync(outFile, latest);
process.stdout.write(`backup_ok=${outFile}\n`);
