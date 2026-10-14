/**
 * La marca con la que se pinta la página, compartida por servidor y cliente.
 *
 * El servidor la resuelve por Host (`$lib/server/brand.js`) y llega a los
 * componentes por `page.data.brand`, que es de la petición: un store global se
 * compartiría en el servidor entre peticiones de dominios distintos.
 */
import logoPorDefecto from '$lib/assets/logo.png';

export const MARCA_POR_DEFECTO = Object.freeze({
	name: 'Nexus',
	isDefault: true,
	logoUrl: null,
	logoDarkUrl: null,
	faviconUrl: null,
	supportEmail: null,
	legalUrl: null,
	tokens: null
});

/** @param {any} brand */
export function marcaOPorDefecto(brand) {
	return brand && typeof brand === 'object' && brand.name ? brand : MARCA_POR_DEFECTO;
}

/**
 * El logo a pintar. En modo oscuro usa el oscuro si la marca lo tiene.
 * @param {any} brand
 * @param {{ oscuro?: boolean }} [opciones]
 */
export function logoDe(brand, { oscuro = false } = {}) {
	const m = marcaOPorDefecto(brand);
	if (m.isDefault) return logoPorDefecto;
	return (oscuro && m.logoDarkUrl) || m.logoUrl || logoPorDefecto;
}

/**
 * «Sección — Marca». La marca por defecto conserva la firma de GeminisLabs.
 * @param {any} brand
 * @param {string} [seccion]
 */
export function tituloDe(brand, seccion) {
	const m = marcaOPorDefecto(brand);
	const nombre = m.isDefault ? 'NEXUS' : m.name;
	return seccion ? `${nombre} — ${seccion}` : nombre;
}

/**
 * Descripción para buscadores y unfurls. Solo la marca por defecto nombra a
 * GeminisLabs: la de un partner no debe delatar quién está debajo.
 * @param {any} brand
 * @param {string} accion p. ej. «Accede a» o «Crea tu cuenta en»
 */
export function descripcionDe(brand, accion) {
	const m = marcaOPorDefecto(brand);
	return m.isDefault
		? `${accion} NEXUS, la plataforma de GeminisLabs para monitorización y gestión de flotas.`
		: `${accion} ${m.name}, monitorización y gestión de flotas.`;
}
