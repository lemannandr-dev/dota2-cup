const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const SteamUser = require('steam-user');

const port = Number(process.env.GC_SERVICE_PORT || 8080);
const appUrl = process.env.APP_INTERNAL_URL || 'http://web2:3000';
const internalToken = process.env.DOTA_GC_INTERNAL_TOKEN || '';
const accountName = process.env.DOTA_GC_BOT_ACCOUNT_NAME || '';
const tokenFile = process.env.DOTA_GC_REFRESH_TOKEN_FILE || '/data/refresh-token';
const refreshToken = process.env.DOTA_GC_BOT_REFRESH_TOKEN || readRefreshToken();
const password = process.env.DOTA_GC_BOT_PASSWORD || '';
const twoFactorCode = process.env.DOTA_GC_BOT_TWO_FACTOR_CODE || '';

let state = 'unconfigured';
let lastError = null;
let steamClient = null;

function readRefreshToken() {
	try {
		return fs.readFileSync(tokenFile, 'utf8').trim();
	} catch {
		return '';
	}
}

function saveRefreshToken(token) {
	fs.mkdirSync(path.dirname(tokenFile), { recursive: true, mode: 0o700 });
	fs.writeFileSync(tokenFile, `${token}\n`, { encoding: 'utf8', mode: 0o600 });
	fs.chmodSync(tokenFile, 0o600);
}

async function publishGuildSnapshot(snapshot) {
	// Only a decoded GC payload may be published. Never synthesize guild fields.
	if (!internalToken) throw new Error('DOTA_GC_INTERNAL_TOKEN is not configured');
	const response = await fetch(`${appUrl}/api/internal/dota-guilds/snapshot`, {
		method: 'POST',
		headers: {
			'content-type': 'application/json',
			authorization: `Bearer ${internalToken}`
		},
		body: JSON.stringify(snapshot)
	});

	if (!response.ok) {
		throw new Error(`Guild snapshot was rejected with HTTP ${response.status}`);
	}
}

function startSteamClient() {
	if (!accountName || (!refreshToken && !password)) {
		console.log('GC worker is waiting for DOTA_GC_BOT_ACCOUNT_NAME and a refresh token or password.');
		return;
	}

	steamClient = new SteamUser({ autoRelogin: true, renewRefreshTokens: true, dataDirectory: '/data/steam-user' });
	steamClient.on('refreshToken', (token) => {
		saveRefreshToken(token);
		console.log('Steam refresh token was stored in the private worker volume.');
	});
	steamClient.on('loggedOn', () => {
		state = 'steam-connected';
		lastError = null;
		steamClient.gamesPlayed(570);
		console.log('Steam session is connected and Dota 2 GC initialization was requested.');
	});
	steamClient.on('error', (error) => {
		state = 'error';
		lastError = error.message;
		console.error(`Steam GC worker error: ${error.message}`);
	});
	steamClient.on('disconnected', () => {
		if (state !== 'error') state = 'disconnected';
	});

	state = 'connecting';
	steamClient.logOn(refreshToken
		? { accountName, refreshToken }
		: { accountName, password, twoFactorCode: twoFactorCode || undefined });
}

const server = http.createServer((req, res) => {
	if (req.method !== 'GET' || req.url !== '/health') {
		res.writeHead(404);
		res.end();
		return;
	}

	res.writeHead(200, { 'content-type': 'application/json' });
	res.end(JSON.stringify({ state, configured: Boolean(accountName && (refreshToken || password)), lastError }));
});

server.listen(port, () => {
	console.log(`GC worker health endpoint is listening on ${port}.`);
	startSteamClient();
});

module.exports = { publishGuildSnapshot };