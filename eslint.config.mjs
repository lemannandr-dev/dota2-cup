import nextVitals from 'eslint-config-next/core-web-vitals';
import nextTypescript from 'eslint-config-next/typescript';

const config = [
	{ ignores: ['.next/**', '.audit-backups/**', 'Version_Buckaps/**', 'node_modules/**', 'playwright-report/**', 'test-results*/**'] },
	...nextVitals,
	...nextTypescript,
	{
		rules: {
			'react-hooks/set-state-in-effect': 'off',
			'react-hooks/immutability': 'off',
			'react-hooks/refs': 'off',
			'react-hooks/purity': 'off',
			'@next/next/no-location-assign-relative-destination': 'warn'
		}
	},
	{
		files: ['**/*.cjs', '**/*.js', 'next-env.d.ts'],
		rules: {
			'@typescript-eslint/no-require-imports': 'off',
			'@typescript-eslint/triple-slash-reference': 'off'
		}
	},
	{
		rules: {
			'@next/next/no-html-link-for-pages': 'warn'
		}
	}
];

export default config;