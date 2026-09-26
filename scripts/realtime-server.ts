import { createServer } from 'node:http';
import { Server } from 'socket.io';
import { createClient } from 'redis';
import { bearerMatches } from '../server/auth/tokens';
import { readLobbyTicket, type LobbyTicket } from '../lib/lobby-ticket';

const port = Number(process.env.REALTIME_PORT || 3003);
const origin = process.env.NEXTAUTH_URL || process.env.APP_URL || 'http://localhost:3000';

const httpServer = createServer(async (req, res) => {
	if (req.method === 'GET' && req.url === '/health') {
		res.writeHead(200, {
			'content-type': 'application/json',
			'access-control-allow-origin': '*'
		});
		res.end(JSON.stringify({ ok: true }));
		return;
	}
	if (req.method === 'POST' && req.url === '/emit') {
		const chunks: Buffer[] = [];
		for await (const chunk of req) chunks.push(chunk as Buffer);
		if (!bearerMatches(req.headers.authorization || null, process.env.DOTA_GC_INTERNAL_TOKEN)) {
			res.writeHead(401);
			res.end();
			return;
		}
		const body = JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}');
		io.to(body.room).emit(body.type || 'event', body.payload || {});
		res.writeHead(204);
		res.end();
		return;
	}
	res.writeHead(404);
	res.end();
});

const io = new Server(httpServer, {
	cors: {
		origin: [origin, 'http://localhost:3002', 'http://localhost:3000', 'http://127.0.0.1:3002'],
		methods: ['GET', 'POST']
	}
});

type Presence = { id: string; name: string; avatar: string | null; sockets: number };
const lobbyOnline = new Map<string, Presence>();

function presenceList() {
	return [...lobbyOnline.values()].slice(0, 40).map(({ id, name, avatar }) => ({ id, name, avatar }));
}

function broadcastPresence() {
	io.to('lobby:chat').emit('lobby:presence', presenceList());
}

function addPresence(ticket: LobbyTicket) {
	const row = lobbyOnline.get(ticket.sub) ?? { id: ticket.sub, name: ticket.name, avatar: ticket.avatar, sockets: 0 };
	row.sockets += 1;
	row.name = ticket.name;
	row.avatar = ticket.avatar;
	lobbyOnline.set(ticket.sub, row);
	broadcastPresence();
}

function removePresence(userId: string) {
	const row = lobbyOnline.get(userId);
	if (!row) return;
	row.sockets -= 1;
	if (row.sockets <= 0) lobbyOnline.delete(userId);
	broadcastPresence();
}

io.on('connection', (socket) => {
	const raw = socket.handshake.auth && typeof socket.handshake.auth === 'object' ? (socket.handshake.auth as { ticket?: unknown }).ticket : null;
	const ticket = typeof raw === 'string' ? readLobbyTicket(raw, process.env.DOTA_GC_INTERNAL_TOKEN || '') : null;
	if (ticket) {
		socket.join('lobby:chat');
		socket.join(`user:${ticket.sub}`);
		addPresence(ticket);
		socket.emit('lobby:presence', presenceList());
		socket.on('disconnect', () => removePresence(ticket.sub));
	}
	socket.on('join', (room: string) => {
		if (typeof room === 'string' && room.startsWith('tournament:')) {
			socket.join(room);
		}
	});
});

async function subscribeRedis() {
	if (!process.env.REDIS_URL) return;
	const subscriber = createClient({ url: process.env.REDIS_URL });
	subscriber.on('error', (error) => console.error('realtime redis', error));
	await subscriber.connect();
	await subscriber.pSubscribe('tournament:*', (message, channel) => {
		try {
			const payload = JSON.parse(message);
			io.to(channel).emit(payload.type || 'event', payload.payload || payload);
		} catch {
			/* ignore malformed */
		}
	});
}

httpServer.listen(port, () => {
	console.log(`Realtime socket listening on ${port}`);
	subscribeRedis().catch((error) => console.error(error));
});
