/**
 * Indicadores unificados GPS + señal celular (2G / LTE).
 * 5 niveles: Sin señal | Bajo | Regular | Bueno | Excelente
 */

/** @typedef {'none' | 'low' | 'regular' | 'good' | 'excellent'} SignalLevel */
/** @typedef {'2g' | 'lte'} NetworkTech */

/**
 * @typedef {object} SignalIndicator
 * @property {SignalLevel} level
 * @property {number} bars 1–5
 * @property {string} label
 * @property {string} hex
 * @property {string} detail  subtítulo (p. ej. "12 Sat" / "≈ -54 dBm")
 * @property {Record<string, string | number | null>} tech  detalle técnico
 */

const LEVEL_META = {
	none: { bars: 1, label: 'Sin señal', hex: '#ef4444' },
	low: { bars: 2, label: 'Bajo', hex: '#ef4444' },
	regular: { bars: 3, label: 'Regular', hex: '#eab308' },
	good: { bars: 4, label: 'Bueno', hex: '#22c55e' },
	excellent: { bars: 5, label: 'Excelente', hex: '#22c55e' }
};

/** @param {SignalLevel} level */
function meta(level) {
	return LEVEL_META[level] ?? LEVEL_META.none;
}

/**
 * Infere 2G vs LTE desde campos disponibles (no hay RAT explícito en latest).
 * @param {Record<string, unknown> | null | undefined} source
 * @returns {NetworkTech}
 */
export function inferNetworkTech(source) {
	const raw = [
		source?.networkType,
		source?.network_type,
		source?.deliveryType,
		source?.delivery_type,
		source?.networkStatus,
		source?.network_status
	]
		.filter((v) => v != null && String(v).trim() !== '')
		.map((v) => String(v).toUpperCase())
		.join(' ');

	if (/LTE|4G|\bNR\b|CAT-?M|NB-?IOT|NBIOT/.test(raw)) return 'lte';
	if (/2G|GSM|GPRS|EDGE|CDMA|UMTS|3G/.test(raw)) return '2g';
	// Flotas actuales: default LTE si no hay pista clara.
	return 'lte';
}

/** @param {NetworkTech} tech */
export function networkTechLabel(tech) {
	return tech === '2g' ? '2G' : 'LTE';
}

/**
 * @param {number|string|null|undefined} satellites
 * @param {{ fixStatus?: string | null }} [opts]
 * @returns {SignalIndicator | null}
 */
export function getGpsIndicator(satellites, opts = {}) {
	if (satellites == null || satellites === '') return null;
	const sats = Number(satellites);
	if (Number.isNaN(sats) || sats < 0) return null;

	/** @type {SignalLevel} */
	let level = 'none';
	if (sats === 0) level = 'none';
	else if (sats <= 4) level = 'low';
	else if (sats <= 7) level = 'regular';
	else if (sats <= 11) level = 'good';
	else level = 'excellent';

	const m = meta(level);
	const fix = opts.fixStatus ? String(opts.fixStatus).toUpperCase() : null;

	return {
		level,
		bars: m.bars,
		label: m.label,
		hex: m.hex,
		detail: `${Math.round(sats)} Sat`,
		tech: {
			Satélites: Math.round(sats),
			Calidad: m.label,
			Fix: fix || '—'
		}
	};
}

/**
 * Convierte RX_LVL del dispositivo a dBm aproximado según tecnología.
 * Si el valor ya viene negativo, se asume dBm.
 * @param {number} rx
 * @param {NetworkTech} tech
 */
export function rxLvlToDbm(rx, tech) {
	if (rx < 0) return Math.round(rx);
	if (rx <= 0) return tech === '2g' ? -111 : -106;

	if (tech === '2g') {
		if (rx <= 15) return -110 + (rx - 1);
		if (rx <= 30) return -95 + (rx - 16);
		if (rx <= 45) return -80 + (rx - 31);
		return -65 + (rx - 46);
	}

	if (rx <= 15) return -104 + (rx - 1);
	if (rx <= 30) return -89 + (rx - 16);
	if (rx <= 45) return -74 + (rx - 31);
	return -59 + (rx - 46);
}

/**
 * @param {number} dbm
 * @param {NetworkTech} tech
 * @returns {SignalLevel}
 */
function levelFromDbm(dbm, tech) {
	if (tech === '2g') {
		if (dbm < -110) return 'none';
		if (dbm <= -96) return 'low';
		if (dbm <= -81) return 'regular';
		if (dbm <= -66) return 'good';
		return 'excellent';
	}
	if (dbm < -105) return 'none';
	if (dbm <= -90) return 'low';
	if (dbm <= -75) return 'regular';
	if (dbm <= -60) return 'good';
	return 'excellent';
}

/**
 * @param {number} rx
 * @param {NetworkTech} tech
 * @returns {SignalLevel}
 */
function levelFromRxLvl(rx, tech) {
	if (rx <= 0) return 'none';
	if (rx <= 15) return 'low';
	if (rx <= 30) return 'regular';
	if (rx <= 45) return 'good';
	const max = tech === '2g' ? 63 : 65;
	if (rx <= max) return 'excellent';
	return 'excellent';
}

/**
 * @param {number|string|null|undefined} rxLvl
 * @param {NetworkTech | Record<string, unknown> | null | undefined} [techOrSource]
 * @returns {SignalIndicator | null}
 */
export function getCellularIndicator(rxLvl, techOrSource = 'lte') {
	if (rxLvl == null || rxLvl === '') return null;
	const rx = Number(rxLvl);
	if (Number.isNaN(rx)) return null;

	/** @type {NetworkTech} */
	const tech =
		techOrSource === '2g' || techOrSource === 'lte'
			? techOrSource
			: inferNetworkTech(/** @type {Record<string, unknown>} */ (techOrSource));

	const isDbm = rx < 0;
	const level = isDbm ? levelFromDbm(rx, tech) : levelFromRxLvl(rx, tech);
	const dbm = rxLvlToDbm(rx, tech);
	const m = meta(level);
	const techLabel = networkTechLabel(tech);

	return {
		level,
		bars: m.bars,
		label: m.label,
		hex: m.hex,
		detail: `≈ ${dbm} dBm`,
		tech: {
			Tecnología: techLabel,
			RX_LVL: isDbm ? '—' : Math.round(rx),
			Señal: `${dbm} dBm`,
			Calidad: m.label
		}
	};
}

/**
 * Compat con getSignalQuality legacy (3 niveles) usado en mapa/chips viejos.
 * @param {number|string|null|undefined} rxLvl
 * @returns {{ grade: 'bad'|'regular'|'good', label: string, hex: string } | null}
 */
export function getSignalQuality(rxLvl) {
	const ind = getCellularIndicator(rxLvl, 'lte');
	if (!ind) return null;
	if (ind.level === 'none' || ind.level === 'low') {
		return { grade: 'bad', label: ind.label, hex: ind.hex };
	}
	if (ind.level === 'regular') {
		return { grade: 'regular', label: ind.label, hex: ind.hex };
	}
	return { grade: 'good', label: ind.label, hex: ind.hex };
}

/** Clases Tailwind del chip de señal por nivel legado */
export const SIGNAL_CHIP_CLASSES = {
	bad: 'border-red-400/50 bg-red-100 text-red-600 dark:border-red-500/30 dark:bg-red-500/15 dark:text-red-400',
	regular:
		'border-yellow-400/60 bg-yellow-100 text-yellow-700 dark:border-yellow-500/30 dark:bg-yellow-500/15 dark:text-yellow-400',
	good: 'border-green-400/50 bg-green-100 text-green-700 dark:border-green-500/30 dark:bg-green-500/15 dark:text-green-400'
};
