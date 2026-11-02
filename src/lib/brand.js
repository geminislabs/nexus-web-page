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

const FAMILIAS_DE_IDENTIDAD = ['sky', 'cyan', 'blue', 'teal', 'green'];
const PASOS = ['50', '100', '200', '300', '400', '500', '600', '700', '800', '900', '950'];

/**
 * Los tokens de un modo más los que la web deriva de ellos: el backend publica
 * `primary`, `accent`, `link` y la rampa, pero el botón principal de Nexus es
 * un degradado con brillo y el fondo del acceso lleva manchas de luz. Un token
 * que el partner ya trae no se pisa.
 * @param {Record<string, string> | null | undefined} tokens
 * @param {'light' | 'dark'} modo
 */
function conDerivados(tokens, modo) {
	if (!tokens) return {};
	const t = (/** @type {string} */ nombre) => tokens[`--color-brand-${nombre}`];
	const primary = t('primary');
	/** @type {Record<string, string>} */
	const derivados = {};
	if (primary) {
		derivados['--color-brand-cta-from'] = t('accent') || primary;
		derivados['--color-brand-cta-to'] = primary;
		derivados['--color-brand-glow'] = t('400') || primary;
		derivados['--color-brand-link'] = primary;
		derivados['--color-brand-focus'] = t('500') || primary;
		derivados['--color-brand-deep'] = t('700') || primary;
		// La pestaña activa es texto sobre el fondo: el `link` ya pasó la
		// medición de contraste al publicar.
		derivados['--color-brand-nav'] = t('link') || primary;
		derivados['--color-brand-nav-bar'] = primary;
	}
	if (t('on-primary')) {
		derivados['--color-brand-on-cta'] = t('on-primary');
	}
	// Las manchas: claras sobre el fondo claro, casi negras sobre el oscuro.
	const aura = modo === 'dark' ? ['900', '950', '900'] : ['200', '100', '300'];
	aura.forEach((paso, i) => {
		if (t(paso)) derivados[`--color-brand-aura-${i + 1}`] = t(paso);
	});
	// Nexus pinta parte de su identidad con otras familias de Tailwind; el partner
	// solo tiene una rampa, así que todas salen de ella, paso por paso.
	for (const familia of FAMILIAS_DE_IDENTIDAD) {
		for (const paso of PASOS) {
			if (t(paso)) derivados[`--color-brand-${familia}-${paso}`] = t(paso);
		}
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
	/**
	 * @param {string} selector
	 * @param {Record<string, string> | null | undefined} tokens
	 * @param {'light' | 'dark'} modo
	 */
	const bloque = (selector, tokens, modo) => {
		const vars = safeCssVars(conDerivados(tokens, modo));
		return vars.length ? `${selector}{${vars.map(([k, v]) => `${k}:${v}`).join(';')}}` : '';
	};
	// Más específicos que el `:root` donde Tailwind declara el tema y que los
	// valores oscuros de Nexus (`:where(html.dark)` en `app.css`).
	return (
		bloque('html:root', m.tokens.light, 'light') + bloque('html.dark:root', m.tokens.dark, 'dark')
	);
}
