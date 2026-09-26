/** Moscow is UTC+3 year-round. Parse the ISO clock only — no Date/Intl (Docker ICU can ignore timezones). */

function moscowClock(value: Date | string | null | undefined) {
	if (!value) return null;
	const iso = value instanceof Date ? value.toISOString() : value;
	const match = iso.match(/(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?/);
	if (!match) return null;
	let day = Number(match[3]);
	let month = Number(match[2]);
	let year = Number(match[1]);
	let hour = Number(match[4]) + 3;
	const minute = match[5];
	const second = match[6] ?? '00';
	const monthDays = [31, year % 4 === 0 ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
	if (hour >= 24) {
		hour -= 24;
		day += 1;
		if (day > monthDays[month - 1]) {
			day = 1;
			month += 1;
			if (month > 12) {
				month = 1;
				year += 1;
			}
		}
	}
	return { year, month, day, hour, minute, second };
}

export function moscowHour(value: Date | string | null | undefined): number | null {
	return moscowClock(value)?.hour ?? null;
}

export function formatMoscowLabel(value: Date | string | null | undefined): string {
	const clock = moscowClock(value);
	if (!clock) return 'Не задано';
	return `${String(clock.day).padStart(2, '0')}.${String(clock.month).padStart(2, '0')}, ${String(clock.hour).padStart(2, '0')}:${clock.minute}`;
}

export function formatMoscowDateTime(value: Date | string | null | undefined): string {
	const clock = moscowClock(value);
	if (!clock) return 'Не задано';
	return `${String(clock.day).padStart(2, '0')}.${String(clock.month).padStart(2, '0')}.${clock.year}, ${String(clock.hour).padStart(2, '0')}:${clock.minute}:${clock.second} МСК`;
}

export function formatMoscowDay(value: Date | string | number | null | undefined): string {
	const date = typeof value === 'number' ? new Date(value * 1000) : value;
	const clock = moscowClock(date);
	if (!clock) return 'Неизвестно';
	return `${String(clock.day).padStart(2, '0')}.${String(clock.month).padStart(2, '0')}.${clock.year}`;
}
