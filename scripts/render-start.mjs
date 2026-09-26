import { spawn } from 'node:child_process';

const external = process.env.RENDER_EXTERNAL_URL;
if (external) {
	process.env.APP_URL = external;
	process.env.NEXTAUTH_URL = external;
}
if (!process.env.DIRECT_DATABASE_URL && process.env.DATABASE_URL) {
	process.env.DIRECT_DATABASE_URL = process.env.DATABASE_URL;
}

const port = process.env.PORT || '3000';
const childEnv = process.env;

function start(command, args) {
	return spawn(command, args, { stdio: 'inherit', env: childEnv });
}

function run(command, args) {
	return new Promise((resolve, reject) => {
		const child = start(command, args);
		child.on('exit', (code) => {
			if (code === 0) resolve();
			else reject(new Error(`${command} ${args.join(' ')} exited ${code}`));
		});
	});
}

await run('npx', ['prisma', 'migrate', 'deploy']);

if (process.env.DISABLE_TOURNAMENT_TICK !== '1') {
	const tick = start('npx', ['tsx', 'scripts/tournament-worker.ts']);
	tick.on('exit', (code, signal) => {
		console.error(`tournament tick stopped (${signal || code})`);
	});
}

const web = start('npx', ['next', 'start', '-H', '0.0.0.0', '-p', port]);
web.on('exit', (code) => process.exit(code ?? 1));

for (const signal of ['SIGTERM', 'SIGINT']) {
	process.on(signal, () => web.kill(signal));
}
