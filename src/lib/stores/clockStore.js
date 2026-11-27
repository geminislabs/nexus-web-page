import { readable } from 'svelte/store';

/**
 * Reloj compartido que avanza cada segundo, para textos como «hace 3 s».
 * Solo corre mientras alguien está suscrito.
 */
export const clock = readable(Date.now(), (set) => {
	const id = setInterval(() => set(Date.now()), 1000);
	return () => clearInterval(id);
});

/**
 * «hace 3 s», «hace 4 min», «hace 2 h»; `null` si no hay fecha.
 * @param {number|string|Date|null|undefined} at
 * @param {number} now
 */
export function sinceLabel(at, now) {
	if (at == null) return null;
	const t = at instanceof Date ? at.getTime() : typeof at === 'number' ? at : Date.parse(at);
	if (!Number.isFinite(t)) return null;
	const s = Math.max(0, Math.round((now - t) / 1000));
	if (s < 60) return `hace ${s} s`;
	const m = Math.round(s / 60);
	if (m < 60) return `hace ${m} min`;
	const h = Math.round(m / 60);
	if (h < 48) return `hace ${h} h`;
	return `hace ${Math.round(h / 24)} d`;
}
