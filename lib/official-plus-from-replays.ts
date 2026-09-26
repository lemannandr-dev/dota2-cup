import { spawn } from 'child_process';
import { access } from 'fs/promises';
import path from 'path';
import { parsePlusProgressLine, type PlusSyncProgress } from '@/lib/plus-sync-policy';
import { steam64ToAccountId } from '@/lib/steam';

export type PublicReplayPlusResult = {
	accountId: number;
	heroProgressPresent: boolean;
	heroes: Array<{
		heroId: number;
		level: number;
		xp: number;
		matchId?: number | null;
		source?: string;
	}>;
	localHeroCount?: number;
	public?: {
		matchesSeen?: number;
		replaysTried?: number;
		replaysParsed?: number;
		skippedNoUrl?: number;
		errors?: Array<{ matchId: number; error: string }>;
	};
};

function scriptPath() {
	return path.join(process.cwd(), 'scripts', 'sync-public-replay-plus.py');
}

async function pythonWorks(command: string) {
	return new Promise<boolean>((resolve) => {
		const child = spawn(command, ['--version'], { stdio: 'ignore' });
		child.once('error', () => resolve(false));
		child.once('exit', (code) => resolve(code === 0));
	});
}

export async function resolvePython() {
	const candidates = [
		process.env.PYTHON_BIN,
		'python3',
		'python',
		'/usr/bin/python3',
		'/usr/local/bin/python3'
	].filter((value): value is string => Boolean(value));
	for (const command of candidates) {
		if (await pythonWorks(command)) return command;
	}
	return null;
}

function runPython(
	command: string,
	args: string[],
	timeoutMs: number,
	onProgress?: (progress: PlusSyncProgress) => void
) {
	return new Promise<string>((resolve, reject) => {
		const child = spawn(command, args, { stdio: ['ignore', 'pipe', 'pipe'] });
		let stdout = '';
		let stderr = '';
		let stderrCarry = '';
		const timer = setTimeout(() => {
			child.kill();
			reject(new Error('Replay sync timed out'));
		}, timeoutMs);
		child.stdout.on('data', (chunk) => {
			stdout += String(chunk);
		});
		child.stderr.on('data', (chunk) => {
			stderrCarry += String(chunk);
			const lines = stderrCarry.split('\n');
			stderrCarry = lines.pop() ?? '';
			for (const line of lines) {
				const progress = parsePlusProgressLine(line);
				if (progress) {
					onProgress?.(progress);
					continue;
				}
				if (line.trim()) stderr += `${line}\n`;
			}
		});
		child.once('error', (error) => {
			clearTimeout(timer);
			reject(error);
		});
		child.once('exit', (code) => {
			clearTimeout(timer);
			const leftover = parsePlusProgressLine(stderrCarry);
			if (leftover) onProgress?.(leftover);
			else if (stderrCarry.trim()) stderr += stderrCarry;
			if (code !== 0) {
				reject(new Error(stderr.trim() || `python exited ${code}`));
				return;
			}
			resolve(stdout);
		});
	});
}

export async function collectOfficialPlusFromPublicReplays(
	steamId64: string,
	maxHeroes = 25,
	opts?: { maxDownloads?: number; onProgress?: (progress: PlusSyncProgress) => void | Promise<void> }
) {
	const accountId = steam64ToAccountId(steamId64);
	if (!accountId) throw new Error('Invalid Steam ID');
	const file = scriptPath();
	await access(file);
	const python = await resolvePython();
	if (!python) {
		throw new Error('На сервере нет Python 3 — без него нельзя разобрать реплей Valve');
	}
	const args = [file, '--account-id', String(accountId), '--max-heroes', String(maxHeroes)];
	if (opts?.maxDownloads != null) {
		args.push('--max-downloads', String(opts.maxDownloads));
	}
	const stdout = await runPython(python, args, 720_000, (progress) => {
		void opts?.onProgress?.(progress);
	});
	const parsed = JSON.parse(stdout) as PublicReplayPlusResult;
	if (!parsed || !Array.isArray(parsed.heroes)) {
		throw new Error('Invalid replay parser output');
	}
	return parsed;
}
