import { spawn } from 'node:child_process';

const command = process.platform === 'win32' ? 'cmd.exe' : 'npx';
const args = process.platform === 'win32'
	? ['/d', '/s', '/c', 'npx playwright test tests/e2e/party-flow.spec.ts']
	: ['playwright', 'test', 'tests/e2e/party-flow.spec.ts'];
const child = spawn(command, args, {
	stdio: 'inherit',
	env: { ...process.env, AEGIS_E2E_PARTY: '1' }
});

child.on('exit', (code, signal) => {
	if (signal) process.kill(process.pid, signal);
	process.exit(code ?? 1);
});
