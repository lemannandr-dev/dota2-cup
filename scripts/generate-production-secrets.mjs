import { randomBytes } from 'node:crypto';

const hex = (bytes) => randomBytes(bytes).toString('hex');
const values = {
	AUTH_SECRET: hex(32),
	NEXTAUTH_SECRET: hex(32),
	DOTA_GC_INTERNAL_TOKEN: hex(32),
	POSTGRES_PASSWORD: hex(24),
	S3_SECRET_KEY: hex(32)
};

console.log('# Generated locally. Store these in the deployment secret manager; do not commit them.');
for (const [name, value] of Object.entries(values)) console.log(`${name}=${value}`);
