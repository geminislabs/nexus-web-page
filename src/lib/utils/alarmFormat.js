/**
 * Texto relativo o fecha corta para eventos de alarma (es-MX).
 * @param {string} iso
 * @returns {string}
 */
export function formatAlarmWhen(iso) {
	try {
		const d = new Date(iso);
		if (Number.isNaN(d.getTime())) return String(iso);
		const now = Date.now();
		const diffMs = Math.max(0, now - d.getTime());
		const mins = Math.floor(diffMs / 60000);
		if (mins < 1) return 'Ahora';
		if (mins < 60) return `hace ${mins} min`;
		const hrs = Math.floor(mins / 60);
		if (hrs < 24) return `hace ${hrs} h`;
		const days = Math.floor(hrs / 24);
		if (days < 7) return `hace ${days} d`;
		return d.toLocaleString('es-MX', {
			day: 'numeric',
			month: 'short',
			year: '2-digit',
			hour: '2-digit',
			minute: '2-digit'
		});
	} catch {
		return String(iso);
	}
}

/** Inicio y fin del día local actual. */
export function getLocalDayBounds(ref = new Date()) {
	const from = new Date(ref);
	from.setHours(0, 0, 0, 0);
	const to = new Date(ref);
	to.setHours(23, 59, 59, 999);
	return { from, to };
}

/**
 * @param {string | Date | null | undefined} value
 * @param {Date} [ref]
 */
export function isSameLocalDay(value, ref = new Date()) {
	if (value == null) return false;
	const d = value instanceof Date ? value : new Date(value);
	if (Number.isNaN(d.getTime())) return false;
	const { from, to } = getLocalDayBounds(ref);
	const t = d.getTime();
	return t >= from.getTime() && t <= to.getTime();
}
