/** @param {Record<string, unknown> | null | undefined} unit */
export function isUnitMoving(unit) {
	const speed = Number(unit?.speed);
	return !Number.isNaN(speed) && speed > 3;
}

/** @param {Record<string, unknown> | null | undefined} unit */
export function formatUnitStatusDate(unit) {
	const dateStr = unit?.gpsDatetime || unit?.lastUpdate;
	if (!dateStr) return '';
	const d = new Date(String(dateStr));
	if (Number.isNaN(d.getTime())) return '';
	const pad = (n) => String(n).padStart(2, '0');
	return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${String(d.getFullYear()).slice(-2)} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/**
 * Estatus de seguimiento alineado con iOS/Android.
 * @param {Record<string, unknown> | null | undefined} unit
 */
export function getUnitTrackingStatus(unit) {
	const speed = Number(unit?.speed);
	const moving = isUnitMoving(unit);
	const engineOn = unit?.engineStatus?.toUpperCase() === 'ON' || unit?.isOnline === true;
	const hasSignal = unit?.lastUpdate != null || unit?.gpsDatetime != null;
	const dateLabel = formatUnitStatusDate(unit);

	if (moving) {
		return {
			filter: 'moving',
			label: `En movimiento · ${Math.round(speed)} km/h`,
			shortLabel: `${Math.round(speed)} km/h`,
			colorClass: 'text-emerald-400',
			dotClass: 'bg-emerald-400'
		};
	}
	if (engineOn) {
		return {
			filter: 'stopped',
			label: dateLabel ? `Online · ${dateLabel}` : 'Online',
			shortLabel: 'Online',
			colorClass: 'text-sky-400',
			dotClass: 'bg-sky-400'
		};
	}
	if (!hasSignal) {
		return {
			filter: 'stopped',
			label: 'Sin señal',
			shortLabel: 'Sin señal',
			colorClass: 'text-amber-400',
			dotClass: 'bg-amber-400'
		};
	}
	return {
		filter: 'stopped',
		label: dateLabel ? `Detenido · ${dateLabel}` : 'Detenido',
		shortLabel: 'Detenido',
		colorClass: 'text-orange-400',
		dotClass: 'bg-orange-400'
	};
}

/** @param {Record<string, unknown> | null | undefined} unit @param {'all' | 'moving' | 'stopped'} filter */
export function unitMatchesTrackingFilter(unit, filter) {
	if (filter === 'all') return true;
	if (filter === 'moving') return isUnitMoving(unit);
	return !isUnitMoving(unit);
}
