import nextEnv from '@next/env';
import { z } from 'zod';

const { loadEnvConfig } = nextEnv;
loadEnvConfig(process.cwd());

const envSchema = z.object({
	NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
	DATABASE_URL: z.string().min(1),
	DIRECT_DATABASE_URL: z.string().min(1),
	AUTH_SECRET: z.string().min(32),
	DOTA_GC_INTERNAL_TOKEN: z.string().min(32),
	REDIS_URL: z.string().min(1),
	NEXT_PUBLIC_APP_NAME: z.string().min(1),
	STEAM_API_KEY: z.string().refine((value) => value === '' || /^[a-f0-9]{32}$/i.test(value), 'must be empty or a 32-character Steam Web API key').default('')
});

const parsed = envSchema.safeParse(process.env);
if (!parsed.success) {
	console.error('Environment validation failed: required variables are missing or too short.');
	for (const issue of parsed.error.issues) console.error(`- ${issue.path.join('.') || 'environment'}: ${issue.message}`);
	process.exit(1);
}

const forbidden = new Map([
	['AUTH_SECRET', 'dev-aegis-arena-change-me-32chars-min'],
	['DOTA_GC_INTERNAL_TOKEN', 'replace-with-a-long-random-token'],
	['POSTGRES_PASSWORD', 'postgres'],
	['S3_SECRET_KEY', 'minio123']
]);

if (parsed.data.NODE_ENV === 'production') {
	const invalid = [...forbidden.entries()]
		.filter(([name, value]) => process.env[name] === value)
		.map(([name]) => name);
	if (invalid.length > 0) {
		console.error(`Production environment uses default secrets: ${invalid.join(', ')}`);
		process.exit(1);
	}
}

console.log(`Environment validation passed for ${parsed.data.NODE_ENV}.`);