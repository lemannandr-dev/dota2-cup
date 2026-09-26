/** @type {import('tailwindcss').Config} */
module.exports = {
	content: [
		"./app/**/*.{js,ts,jsx,tsx}",
		"./components/**/*.{js,ts,jsx,tsx}"
	],
	theme: {
		extend: {
			colors: {
				ink: '#06080C',
				panel: '#0D1219',
				panel2: '#121A24',
				cream: '#F1E9D6',
				muted: '#8994A3',
				line: '#25303D',
				aegis: '#D8A84E',
				aegisSoft: '#F2CF7B',
				radiant: '#63C174',
				dire: '#D45555',
				info: '#72A7FF'
			},
			fontFamily: {
				display: ['var(--font-display)', 'var(--font-sans)', 'sans-serif'],
				sans: ['var(--font-sans)', 'sans-serif'],
				mono: ['ui-monospace', 'SFMono-Regular', 'Menlo', 'Consolas', 'monospace']
			},
			maxWidth: {
				shell: '1440px',
				admin: '1760px'
			},
			borderRadius: {
				card: '8px'
			}
		}
	},
	plugins: [require("tailwindcss-animate")]
};












