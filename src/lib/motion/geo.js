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
