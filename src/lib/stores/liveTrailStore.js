import { writable } from 'svelte/store';

/**
 * Recorrido reciente de cada unidad, armado con las posiciones que llegan por
 * el stream desde que se abrió el panel. Es lo que dibuja el mini-recorrido de
 * las tarjetas de la columna de flota sin pedir nada al backend.
 *
 * El recorrido completo del día necesita los puntos de todos los trayectos;
 * eso queda para el endpoint planeado (docs/architecture/resumen-del-dia-de-flota.md).
 */

/** Puntos que se guardan por unidad (a un reporte cada ~10 s, unos 20 minutos). */
export const TRAIL_MAX_POINTS = 120;
/** Distancia mínima para registrar un punto nuevo: el ruido del GPS parado no cuenta. */
export const TRAIL_MIN_METERS = 15;

/** @typedef {{ lat: number, lng: number, t: number }} TrailPoint */

/** Distancia aproximada en metros (equirrectangular; sobra para tramos cortos). */
export function metersBetween(
	/** @type {{lat:number,lng:number}} */ a,
	/** @type {{lat:number,lng:number}} */ b
) {
	const R = 6_371_000;
	const toRad = Math.PI / 180;
	const x = (b.lng - a.lng) * toRad * Math.cos(((a.lat + b.lat) / 2) * toRad);
	const y = (b.lat - a.lat) * toRad;
	return Math.hypot(x, y) * R;
}

/** @param {Record<string, unknown>} v */
function coordsOf(v) {
	const lat = Number(v?.latitude ?? v?.lat);
	const lng = Number(v?.longitude ?? v?.lng);
	if (!Number.isFinite(lat) || !Number.isFinite(lng) || (lat === 0 && lng === 0)) return null;
	return { lat, lng };
}

/**
 * Devuelve un nuevo mapa de recorridos con la posición actual de cada unidad,
 * o el mismo objeto si nada cambió (para no notificar a los suscriptores).
 * @param {Record<string, TrailPoint[]>} trails
 * @param {Array<Record<string, any>>} vehicles
 * @param {number} now
 */
export function appendPositions(trails, vehicles, now) {
	/** @type {Record<string, TrailPoint[]> | null} */
	let next = null;
	for (const v of vehicles || []) {
		const id = v?.id != null ? String(v.id) : '';
		const p = id ? coordsOf(v) : null;
		if (!p) continue;
		const list = trails[id] || [];
		const last = list[list.length - 1];
		if (last && metersBetween(last, p) < TRAIL_MIN_METERS) continue;
		next ??= { ...trails };
		next[id] = [...list, { ...p, t: now }].slice(-TRAIL_MAX_POINTS);
	}
	return next ?? trails;
}

/**
 * Proyecta un recorrido a un lienzo de `width × height` conservando la
 * proporción, con un margen. Devuelve `null` si hay menos de dos puntos.
 * @param {TrailPoint[]} points
 * @param {number} width
 * @param {number} height
 * @param {number} [pad]
 */
export function projectTrail(points, width, height, pad = 8) {
	if (!points || points.length < 2) return null;
	const midLat = points.reduce((a, p) => a + p.lat, 0) / points.length;
	const k = Math.cos((midLat * Math.PI) / 180);
	const xs = points.map((p) => p.lng * k);
	const ys = points.map((p) => -p.lat);
	const minX = Math.min(...xs);
	const maxX = Math.max(...xs);
	const minY = Math.min(...ys);
	const maxY = Math.max(...ys);
	const spanX = Math.max(maxX - minX, 1e-9);
	const spanY = Math.max(maxY - minY, 1e-9);
	const scale = Math.min((width - pad * 2) / spanX, (height - pad * 2) / spanY);
	const ox = (width - spanX * scale) / 2 - minX * scale;
	const oy = (height - spanY * scale) / 2 - minY * scale;
	const pts = xs.map((x, i) => [x * scale + ox, ys[i] * scale + oy]);
	return {
		d: pts.map(([x, y], i) => `${i ? 'L' : 'M'}${x.toFixed(1)},${y.toFixed(1)}`).join(''),
		end: pts[pts.length - 1]
	};
}

/** @type {import('svelte/store').Writable<Record<string, TrailPoint[]>>} */
export const liveTrails = writable({});

/** Registra las posiciones actuales; pensado para suscribirse al store de vehículos. */
export function recordPositions(
	/** @type {Array<Record<string, any>>} */ vehicles,
	now = Date.now()
) {
	liveTrails.update((t) => appendPositions(t, vehicles, now));
}
