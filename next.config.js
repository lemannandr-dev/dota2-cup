/** @type {import('next').NextConfig} */
const nextConfig = {
	reactStrictMode: true,
	devIndicators: false,
	productionBrowserSourceMaps: false,
	allowedDevOrigins: ['10.0.2.2'],
	serverExternalPackages: ['redis', '@redis/client'],
	// Keep the legacy Node fallback available for webpack and mirror it in
	// Turbopack so both bundlers resolve the server-only dependency consistently.
	turbopack: {},
	async headers() {
		return [{
			source: '/:path*',
			headers: [
				{ key: 'X-Content-Type-Options', value: 'nosniff' },
				{ key: 'X-Frame-Options', value: 'DENY' },
				{ key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
				{ key: 'Permissions-Policy', value: 'camera=(self), microphone=(), geolocation=()' },
				{ key: 'Cross-Origin-Opener-Policy', value: 'same-origin' },
				{
					key: 'Content-Security-Policy',
					value: [
						"default-src 'self'",
						"script-src 'self' 'unsafe-inline' 'unsafe-eval'",
						"style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
						"font-src 'self' https://fonts.gstatic.com",
						"img-src 'self' data: blob: https:",
						"connect-src 'self' http://localhost:3003 http://127.0.0.1:3003 http://10.0.2.2:3003 https://api.opendota.com https://id.twitch.tv https://api.twitch.tv https://steamcommunity.com wss: ws:",
						"frame-src 'self' https://player.twitch.tv https://www.twitch.tv https://embed.twitch.tv",
						"child-src 'self' https://player.twitch.tv https://www.twitch.tv",
						"frame-ancestors 'none'"
					].join('; ')
				}
			]
		}, {
			source: '/sw.js',
			headers: [
				{ key: 'Cache-Control', value: 'no-cache, no-store, must-revalidate' },
				{ key: 'Service-Worker-Allowed', value: '/' }
			]
		}];
	},
	webpack: (config, { dev }) => {
		config.resolve.fallback = {
			...(config.resolve.fallback ?? {}),
			string_decoder: false
		};
		if (dev) {
			config.watchOptions = {
				...(config.watchOptions ?? {}),
				ignored: ['**/node_modules/**', '**/.git/**', '**/.next/**', '**/gc-service/**', '**/tests/**']
			};
		}
		return config;
	},
	images: {
		remotePatterns: [
			{ protocol: 'https', hostname: 'avatars.steamstatic.com' },
			{ protocol: 'https', hostname: 'static-cdn.jtvnw.net' },
			{ protocol: 'https', hostname: 'www.opendota.com' },
			{ protocol: 'https', hostname: 'cdn.cloudflare.steamstatic.com' }
		]
	}
};

module.exports = nextConfig;
