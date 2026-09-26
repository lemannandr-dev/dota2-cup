export const LOBBY_BODY_MAX = 280;
export const LOBBY_MENTION_MAX = 5;

const MENTION = /@\[([^\[\]\n]{1,32})\]\(([a-z0-9]{8,40})\)/g;

export type LobbyPart = { type: 'text'; text: string } | { type: 'mention'; id: string; name: string };

export type LobbyAuthor = { id: string; displayName: string; avatarUrl: string | null };

export type LobbyMessageView = {
	id: string;
	body: string;
	createdAt: string;
	author: LobbyAuthor;
};

export function sanitizeLobbyBody(raw: string) {
	return raw
		.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '')
		.replace(/[<>]/g, '')
		.replace(/[ \t]+\n/g, '\n')
		.replace(/\n{3,}/g, '\n\n')
		.trim();
}

export function mentionIds(body: string) {
	const ids: string[] = [];
	for (const match of body.matchAll(MENTION)) {
		if (!ids.includes(match[2])) ids.push(match[2]);
		if (ids.length >= LOBBY_MENTION_MAX) break;
	}
	return ids;
}

export function safeMentionName(name: string) {
	return name.replace(/[\[\]]/g, '').replace(/\s+/g, ' ').trim().slice(0, 32);
}

export function rewriteLobbyMentions(body: string, people: Map<string, string>) {
	let count = 0;
	return body.replace(MENTION, (_full, name: string, id: string) => {
		count += 1;
		if (count > LOBBY_MENTION_MAX) return safeMentionName(name);
		const display = people.get(id);
		const safe = display ? safeMentionName(display) : '';
		if (!safe) return safeMentionName(name);
		return `@[${safe}](${id})`;
	});
}

export function splitLobbyBody(body: string): LobbyPart[] {
	const parts: LobbyPart[] = [];
	let last = 0;
	for (const match of body.matchAll(new RegExp(MENTION.source, 'g'))) {
		const index = match.index ?? 0;
		if (index > last) parts.push({ type: 'text', text: body.slice(last, index) });
		parts.push({ type: 'mention', id: match[2], name: match[1] });
		last = index + match[0].length;
	}
	if (last < body.length) parts.push({ type: 'text', text: body.slice(last) });
	return parts;
}

export function mentionQueryAt(value: string, caret: number) {
	const left = value.slice(0, Math.max(0, caret));
	const match = /(^|\s)@([^\s@[\]]{0,24})$/.exec(left);
	return match ? match[2] : null;
}

export function insertLobbyMention(value: string, caret: number, person: { id: string; displayName: string }) {
	const left = value.slice(0, Math.max(0, caret));
	const match = /(^|\s)@([^\s@[\]]{0,24})$/.exec(left);
	const safe = safeMentionName(person.displayName);
	if (!match || !safe || !/^[a-z0-9]{8,40}$/.test(person.id)) return { value, caret };
	const start = left.length - match[2].length - 1;
	const token = `@[${safe}](${person.id}) `;
	const next = value.slice(0, start) + token + value.slice(caret);
	return { value: next, caret: start + token.length };
}
