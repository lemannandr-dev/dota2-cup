import { spawn } from 'node:child_process';

const command = process.platform === 'win32' ? 'cmd.exe' : 'npx';
const args =
	process.platform === 'win32'
		? ['/d', '/s', '/c', 'npx playwright test tests/e2e/closed-cohort.spec.ts --project=iphone-chromium']
		: ['playwright', 'test', 'tests/e2e/closed-cohort.spec.ts', '--project=iphone-chromium'];

const child = spawn(command, args, {
	stdio: 'inherit',
	env: { ...process.env, AEGIS_E2E_CLOSED: '1' }
});

child.on('exit', (code, signal) => {
	if (signal) process.kill(process.pid, signal);
	process.exit(code ?? 1);
});
