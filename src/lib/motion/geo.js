/**
 * Cálculos para deslizar un marcador entre dos posiciones GPS.
 * Para distancias de una actualización a la siguiente (metros o pocos km)
 * basta la aproximación equirectangular; no hace falta haversine.
 */

const EARTH_RADIUS_M = 6371000;

/** Duración del deslizamiento de un marcador entre dos posiciones. */
export const MARKER_GLIDE_MS = 900;

/**
 * @typedef {{ lat: number, lng: number }} LatLng
 */

/**
 * @param {LatLng} a
 * @param {LatLng} b
 * @param {number} t 0..1
 * @returns {LatLng}
 */
export function lerpLatLng(a, b, t) {
	return { lat: a.lat + (b.lat - a.lat) * t, lng: a.lng + (b.lng - a.lng) * t };
}

/**
 * Distancia aproximada en metros.
 * @param {LatLng} a
 * @param {LatLng} b
 */
export function distanceMeters(a, b) {
	const rad = Math.PI / 180;
	const x = (b.lng - a.lng) * rad * Math.cos(((a.lat + b.lat) / 2) * rad);
	const y = (b.lat - a.lat) * rad;
	return Math.hypot(x, y) * EARTH_RADIUS_M;
}

/**
 * Si vale la pena deslizar: no por un temblor de menos de un metro, y no si
 * el salto es tan grande que es un dato raro (o la unidad estuvo apagada) y
 * no un recorrido; ahí cruzar el mapa en un segundo engaña.
 * @param {LatLng} from
 * @param {LatLng} to
 * @param {{ minMeters?: number, maxMeters?: number }} [opts]
 */
export function shouldGlide(from, to, { minMeters = 1, maxMeters = 2000 } = {}) {
	const values = [from?.lat, from?.lng, to?.lat, to?.lng];
	if (!values.every((v) => typeof v === 'number' && Number.isFinite(v))) return false;
	const d = distanceMeters(from, to);
	return d >= minMeters && d <= maxMeters;
}

/**
 * Distancia acumulada desde el primer punto hasta cada punto del recorrido.
 * @param {LatLng[]} path
 * @returns {number[]}
 */
export function cumulativeDistances(path) {
	const out = new Array(path.length);
	let total = 0;
	for (let i = 0; i < path.length; i++) {
		if (i > 0) total += distanceMeters(path[i - 1], path[i]);
		out[i] = total;
	}
	return out;
}

/**
 * Tramo del recorrido hasta la fracción `t` de su distancia, con el punto
 * de la punta interpolado. Medir por distancia y no por índice hace que la
 * línea avance a velocidad constante aunque los puntos no estén espaciados
 * igual (en un semáforo se acumulan muchos).
 * @param {LatLng[]} path
 * @param {number[]} cumulative de `cumulativeDistances(path)`
 * @param {number} t 0..1
 * @returns {{ path: LatLng[], head: LatLng }}
 */
export function pathAtProgress(path, cumulative, t) {
	const last = path.length - 1;
	const total = cumulative[last] ?? 0;
	if (last < 1 || total <= 0 || t >= 1) return { path, head: path[last] };
	const target = Math.max(0, t) * total;
	// Búsqueda binaria del tramo [i, i+1] que contiene `target`.
	let lo = 0;
	let hi = last;
	while (hi - lo > 1) {
		const mid = (lo + hi) >> 1;
		if (cumulative[mid] <= target) lo = mid;
		else hi = mid;
	}
	const span = cumulative[hi] - cumulative[lo];
	const head = lerpLatLng(path[lo], path[hi], span > 0 ? (target - cumulative[lo]) / span : 0);
	return { path: [...path.slice(0, lo + 1), head], head };
}
