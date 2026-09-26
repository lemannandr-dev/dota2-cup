const heard = new Set<string>();
let audio: AudioContext | null = null;

function audioContext() {
	const Ctx = window.AudioContext || (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
	if (!Ctx) return null;
	if (!audio) audio = new Ctx();
	return audio;
}

export function warmLobbyChime() {
	const ctx = audioContext();
	if (ctx?.state === 'suspended') void ctx.resume();
}

export function playLobbyChime() {
	const ctx = audioContext();
	if (!ctx) return;
	if (ctx.state === 'suspended') void ctx.resume();
	const now = ctx.currentTime;
	const gain = ctx.createGain();
	gain.gain.setValueAtTime(0.0001, now);
	gain.gain.exponentialRampToValueAtTime(0.07, now + 0.02);
	gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.42);
	gain.connect(ctx.destination);
	for (const [offset, frequency] of [[0, 784], [0.12, 1175]] as const) {
		const tone = ctx.createOscillator();
		tone.type = 'sine';
		tone.frequency.setValueAtTime(frequency, now + offset);
		tone.connect(gain);
		tone.start(now + offset);
		tone.stop(now + offset + 0.22);
	}
}

export function hearLobbyMention(messageId: string) {
	if (!messageId || heard.has(messageId)) return false;
	heard.add(messageId);
	if (heard.size > 80) {
		const oldest = heard.values().next().value;
		if (oldest) heard.delete(oldest);
	}
	playLobbyChime();
	return true;
}
