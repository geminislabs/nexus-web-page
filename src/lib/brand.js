/**
 * La marca con la que se pinta la página, compartida por servidor y cliente.
 *
 * El servidor la resuelve por Host (`$lib/server/brand.js`) y llega a los
 * componentes por `page.data.brand`, que es de la petición: un store global se
 * compartiría en el servidor entre peticiones de dominios distintos.
 */
import logoPorDefecto from '$lib/assets/logo.png';
import { safeCssVars } from '$lib/utils/brandForm.js';

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

/**
 * Los tokens de un modo más los que la web deriva de ellos: el backend publica
 * `primary`, `accent` y la rampa, pero el botón principal de Nexus es un
 * degradado con brillo. Un token que el partner ya trae no se pisa.
 * @param {Record<string, string> | null | undefined} tokens
 */
function conDerivados(tokens) {
	if (!tokens) return {};
	const primary = tokens['--color-brand-primary'];
	const derivados = {};
	if (primary) {
		derivados['--color-brand-cta-from'] = tokens['--color-brand-accent'] || primary;
		derivados['--color-brand-cta-to'] = primary;
		derivados['--color-brand-glow'] = tokens['--color-brand-400'] || primary;
	}
	if (tokens['--color-brand-on-primary']) {
		derivados['--color-brand-on-cta'] = tokens['--color-brand-on-primary'];
	}
	return { ...derivados, ...tokens };
}

/**
 * El CSS que pinta la página con los colores del partner: sobrescribe los
 * `--color-brand-*` de `app.css` (que son los de Nexus) en claro y en oscuro.
 * Con la marca por defecto, o sin tokens, no hay nada que sobrescribir.
 *
 * Va inline en el `<head>`, así el primer pintado ya sale con la marca. Solo
 * nombres `--color-brand-*` y valores `#rrggbb` (`safeCssVars`): nada de lo que
 * escriba el partner puede cerrar la etiqueta ni colar otra regla.
 * @param {any} brand
 */
export function estiloDeMarca(brand) {
	const m = marcaOPorDefecto(brand);
	if (m.isDefault || !m.tokens) return '';
	/** @param {string} selector @param {Record<string, string> | null | undefined} tokens */
	const bloque = (selector, tokens) => {
		const vars = safeCssVars(conDerivados(tokens));
		return vars.length ? `${selector}{${vars.map(([k, v]) => `${k}:${v}`).join(';')}}` : '';
	};
	// Más específicos que el `:root` donde Tailwind declara el tema.
	return bloque('html:root', m.tokens.light) + bloque('html.dark:root', m.tokens.dark);
}
