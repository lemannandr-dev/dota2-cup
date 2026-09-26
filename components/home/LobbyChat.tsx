'use client';

import { useEffect, useRef, useState } from 'react';
import { io, type Socket } from 'socket.io-client';
import { SteamAvatar } from '@/components/desk/SteamAvatar';
import { isRealtimeUp } from '@/lib/realtime-client';
import { resolveRealtimeUrl } from '@/lib/realtime-url';
import {
	insertLobbyMention,
	mentionQueryAt,
	splitLobbyBody,
	type LobbyAuthor,
	type LobbyMessageView
} from '@/lib/lobby-chat';
import { playerCardHref } from '@/lib/site';

type Person = LobbyAuthor;
type Presence = { id: string; name: string; avatar: string | null };

function clock(iso: string) {
	const date = new Date(iso);
	if (Number.isNaN(date.getTime())) return '';
	return date.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
}

function MessageBody({ body }: { body: string }) {
	return (
		<p className="whitespace-pre-wrap break-words text-sm leading-5 text-cream">
			{splitLobbyBody(body).map((part, index) =>
				part.type === 'mention' ? (
					<a key={`${part.id}-${index}`} href={playerCardHref(part.id)} className="text-aegisSoft hover:text-aegis">
						@{part.name}
					</a>
				) : (
					<span key={index}>{part.text}</span>
				)
			)}
		</p>
	);
}

export function LobbyChat({ signedIn }: { signedIn: boolean }) {
	const [messages, setMessages] = useState<LobbyMessageView[]>([]);
	const [online, setOnline] = useState<Presence[]>([]);
	const [text, setText] = useState('');
	const [people, setPeople] = useState<Person[]>([]);
	const [query, setQuery] = useState<string | null>(null);
	const [error, setError] = useState('');
	const [live, setLive] = useState(false);
	const [sending, setSending] = useState(false);
	const listRef = useRef<HTMLDivElement | null>(null);
	const fieldRef = useRef<HTMLTextAreaElement | null>(null);
	const [ticket, setTicket] = useState<string | null>(null);

	useEffect(() => {
		if (!signedIn) return;
		let cancelled = false;
		const pull = async () => {
			const res = await fetch('/api/lobby/chat', { cache: 'no-store' });
			if (!res.ok || cancelled) return;
			const payload = (await res.json()) as { messages?: LobbyMessageView[]; ticket?: string | null };
			if (payload.ticket) setTicket((current) => current ?? payload.ticket ?? null);
			setMessages(payload.messages ?? []);
		};
		void pull();
		const timer = window.setInterval(() => {
			if (!live) void pull();
		}, 8000);
		return () => {
			cancelled = true;
			window.clearInterval(timer);
		};
	}, [signedIn, live]);

	useEffect(() => {
		if (!signedIn || !ticket) return;
		let cancelled = false;
		const holder: { socket: Socket | null } = { socket: null };
		void (async () => {
			const url = resolveRealtimeUrl(process.env.NEXT_PUBLIC_SOCKET_URL, window.location.href);
			if (!url || cancelled || !(await isRealtimeUp(url))) return;
			const socket = io(url, {
				transports: ['websocket'],
				reconnection: true,
				reconnectionAttempts: 8,
				reconnectionDelay: 800,
				timeout: 2000,
				auth: { ticket }
			});
			holder.socket = socket;
			socket.on('connect', () => {
				if (!cancelled) setLive(true);
			});
			socket.on('disconnect', () => {
				if (!cancelled) setLive(false);
			});
			socket.on('lobby:message', (message: LobbyMessageView) => {
				if (!message?.id) return;
				setMessages((current) => (current.some((row) => row.id === message.id) ? current : [...current, message].slice(-40)));
			});
			socket.on('lobby:presence', (rows: Presence[]) => {
				if (Array.isArray(rows)) setOnline(rows.slice(0, 12));
			});
		})();
		return () => {
			cancelled = true;
			holder.socket?.disconnect();
			setLive(false);
		};
	}, [signedIn, ticket]);

	useEffect(() => {
		const node = listRef.current;
		if (node) node.scrollTop = node.scrollHeight;
	}, [messages.length]);

	useEffect(() => {
		if (query === null || query.length < 1) {
			setPeople([]);
			return;
		}
		const timer = window.setTimeout(() => {
			void fetch(`/api/lobby/chat/people?q=${encodeURIComponent(query)}`, { cache: 'no-store' })
				.then((res) => (res.ok ? res.json() : { people: [] }))
				.then((payload: { people?: Person[] }) => setPeople(payload.people ?? []))
				.catch(() => setPeople([]));
		}, 180);
		return () => window.clearTimeout(timer);
	}, [query]);

	function syncQuery(value: string, caret: number) {
		setText(value);
		setQuery(mentionQueryAt(value, caret));
	}

	function choose(person: Person) {
		const field = fieldRef.current;
		const caret = field?.selectionStart ?? text.length;
		const next = insertLobbyMention(text, caret, person);
		setText(next.value);
		setQuery(null);
		setPeople([]);
		requestAnimationFrame(() => {
			field?.focus();
			field?.setSelectionRange(next.caret, next.caret);
		});
	}

	async function send() {
		const draft = text;
		if (!draft.trim() || sending) return;
		setSending(true);
		setError('');
		try {
			const res = await fetch('/api/lobby/chat', {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({ text: draft })
			});
			const payload = (await res.json()) as { message?: LobbyMessageView; error?: string };
			if (!res.ok || !payload.message) {
				setError(payload.error || 'Не отправилось');
				return;
			}
			setText('');
			setQuery(null);
			setPeople([]);
			setMessages((current) => (current.some((row) => row.id === payload.message?.id) ? current : [...current, payload.message as LobbyMessageView].slice(-40)));
		} catch {
			setError('Нет связи с чатом');
		} finally {
			setSending(false);
		}
	}

	if (!signedIn) {
		return (
			<aside id="lobby-chat" data-lobby-chat="locked" className="w-full shrink-0 self-start rounded-card border border-white/15 bg-black/55 p-3.5 backdrop-blur-md lg:mt-14 lg:w-[20.5rem]">
				<p className="text-[10px] uppercase tracking-[0.16em] text-aegisSoft">Чат арены</p>
				<p className="mt-2 text-sm leading-6 text-cream">Войдите через Steam, чтобы писать в чат и получать отметки.</p>
				<a href="/api/auth/steam" className="mt-3 inline-flex text-sm text-aegisSoft hover:text-aegis">
					Войти через Steam
				</a>
			</aside>
		);
	}

	return (
		<aside id="lobby-chat" data-lobby-chat="open" className="flex h-[18.5rem] w-full shrink-0 flex-col self-start rounded-card border border-white/15 bg-black/55 backdrop-blur-md lg:mt-14 lg:w-[20.5rem]">
			<div className="flex items-center justify-between gap-2 px-3 pt-3">
				<p className="text-[10px] uppercase tracking-[0.16em] text-aegisSoft">Чат арены</p>
				<span className={`text-[10px] uppercase tracking-[0.12em] ${live ? 'text-radiant' : 'text-muted'}`}>{live ? 'в эфире' : 'обновляется'}</span>
			</div>
			{online.length > 0 ? (
				<ul className="mt-2 flex gap-1.5 overflow-hidden px-3" aria-label="Сейчас в чате">
					{online.map((person) => (
						<li key={person.id} title={person.name}>
							<SteamAvatar url={person.avatar} name={person.name} className="h-6 w-6 border border-white/20" />
						</li>
					))}
				</ul>
			) : null}
			<div ref={listRef} className="mt-2 min-h-0 flex-1 space-y-2 overflow-y-auto px-3" role="log" aria-label="Сообщения чата">
				{messages.length === 0 ? <p className="py-6 text-center text-xs text-muted">Пока тихо. Напишите первое сообщение.</p> : null}
				{messages.map((message) => (
					<article key={message.id} className="flex items-start gap-2">
						<a href={playerCardHref(message.author.id)} className="mt-0.5 shrink-0" aria-label={message.author.displayName}>
							<SteamAvatar url={message.author.avatarUrl} name={message.author.displayName} className="h-7 w-7 border border-white/15" />
						</a>
						<div className="min-w-0">
							<div className="flex items-baseline gap-2">
								<a href={playerCardHref(message.author.id)} className="truncate text-xs text-aegisSoft hover:text-aegis">
									{message.author.displayName}
								</a>
								<time className="text-[10px] text-muted" dateTime={message.createdAt}>
									{clock(message.createdAt)}
								</time>
							</div>
							<MessageBody body={message.body} />
						</div>
					</article>
				))}
			</div>
			<form
				className="relative border-t border-white/10 p-2"
				onSubmit={(event) => {
					event.preventDefault();
					void send();
				}}
			>
				{people.length > 0 ? (
					<ul className="absolute bottom-full left-2 right-2 z-10 mb-1 max-h-36 overflow-y-auto rounded-lg border border-white/15 bg-ink/95 py-1 shadow-xl">
						{people.map((person) => (
							<li key={person.id}>
								<button type="button" onClick={() => choose(person)} className="flex w-full items-center gap-2 px-2 py-1.5 text-left hover:bg-white/5">
									<SteamAvatar url={person.avatarUrl} name={person.displayName} className="h-6 w-6" />
									<span className="truncate text-sm text-cream">{person.displayName}</span>
								</button>
							</li>
						))}
					</ul>
				) : null}
				<label className="sr-only" htmlFor="lobby-chat-text">
					Сообщение в чат арены
				</label>
				<textarea
					id="lobby-chat-text"
					ref={fieldRef}
					value={text}
					rows={2}
					maxLength={280}
					placeholder="@ник — отметить профиль"
					className="w-full resize-none rounded-lg border border-white/10 bg-black/30 px-2.5 py-2 text-sm text-cream outline-none placeholder:text-muted focus:border-aegis/50"
					onChange={(event) => syncQuery(event.target.value, event.target.selectionStart)}
					onKeyDown={(event) => {
						if (event.key === 'Enter' && !event.shiftKey) {
							event.preventDefault();
							void send();
						}
					}}
				/>
				<div className="mt-1 flex items-center justify-between gap-2">
					<span className="text-[10px] text-muted">{error || 'Только игроки со Steam'}</span>
					<button type="submit" disabled={sending || !text.trim()} className="rounded-md bg-aegis/20 px-2.5 py-1 text-xs text-aegisSoft hover:bg-aegis/30 disabled:opacity-40">
						Отправить
					</button>
				</div>
			</form>
		</aside>
	);
}
