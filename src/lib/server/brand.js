/**
 * La marca del dominio por el que entró el navegador (Fase 4, §7).
 *
 * `hooks.server.js` la resuelve en cada petición antes de pintar el HTML, para
 * que el primer pintado, el título y el unfurl de WhatsApp salgan ya con la
 * marca correcta. **El Host solo elige apariencia y nunca autoriza**: de aquí no
 * sale ni entra nada de datos ni de sesión.
 *
 * Falla abierto: si admin-api no contesta a tiempo o responde algo raro, se
 * pinta la marca por defecto en vez de dejar la página sin pintar.
 */

import { MARCA_POR_DEFECTO } from '$lib/brand.js';

export { MARCA_POR_DEFECTO };

const CACHE_MS = 60_000;
// Un fallo se recuerda menos: que la marca vuelva pronto cuando admin-api vuelva.
const CACHE_FALLO_MS = 10_000;
const TIMEOUT_MS = 1500;
const MAX_ENTRADAS = 500;

/** @type {Map<string, { brand: typeof MARCA_POR_DEFECTO, expira: number }>} */
const cache = new Map();

/** Solo `https:`: un logo `javascript:` o `http:` no se pinta. */
function urlSegura(valor) {
	if (typeof valor !== 'string' || !valor) return null;
	try {
		const url = new URL(valor);
		return url.protocol === 'https:' ? url.href : null;
	} catch {
		return null;
	}
}

/** Solo propiedades `--color-brand-*` con un color hex: nada que inyectar en el CSS. */
function tokensSeguros(tokens) {
	if (!tokens || typeof tokens !== 'object') return null;
	const limpio = {};
	for (const modo of ['light', 'dark']) {
		const mapa = tokens[modo];
		if (!mapa || typeof mapa !== 'object') return null;
		limpio[modo] = {};
		for (const [clave, valor] of Object.entries(mapa)) {
			if (/^--color-brand-[a-z0-9-]+$/.test(clave) && /^#[0-9a-f]{6}$/i.test(String(valor))) {
				limpio[modo][clave] = String(valor).toLowerCase();
			}
		}
	}
	return limpio;
}

/**
 * Convierte la respuesta de `/tenant-config` en lo que la web necesita.
 * @param {any} config
 */
export function marcaDesdeConfig(config) {
	if (!config || config.is_default !== false) return MARCA_POR_DEFECTO;
	const tema = config.theme && typeof config.theme === 'object' ? config.theme : {};
	const nombre = typeof config.brand_name === 'string' ? config.brand_name.trim() : '';
	return {
		name: nombre.slice(0, 80) || MARCA_POR_DEFECTO.name,
		isDefault: false,
		logoUrl: urlSegura(tema.logo_url),
		logoDarkUrl: urlSegura(tema.logo_dark_url),
		faviconUrl: urlSegura(tema.favicon_url),
		supportEmail: typeof tema.support_email === 'string' ? tema.support_email : null,
		legalUrl: urlSegura(tema.legal_url),
		tokens: tokensSeguros(tema.tokens)
	};
}

/**
 * El host por el que entró el navegador. No sirve `event.url.host`: con `ORIGIN`
 * definido, adapter-node lo fija a ese dominio sea cual sea el de la petición.
 * @param {Request} request
 * @param {URL} url
 */
export function hostDeLaPeticion(request, url) {
	const crudo = request.headers.get('host') || url.host || '';
	return crudo.trim().toLowerCase();
}

/**
 * @param {string} host
 * @param {{ apiBase: string, fetch?: typeof fetch, ahora?: () => number }} opciones
 */
export async function resolverMarca(host, { apiBase, fetch: f = fetch, ahora = Date.now }) {
	if (!host) return MARCA_POR_DEFECTO;

	const enCache = cache.get(host);
	if (enCache && enCache.expira > ahora()) return enCache.brand;

	let brand = MARCA_POR_DEFECTO;
	let vida = CACHE_FALLO_MS;
	try {
		const url = `${apiBase}/tenant-config?host=${encodeURIComponent(host)}`;
		const respuesta = await f(url, { signal: AbortSignal.timeout(TIMEOUT_MS) });
		if (respuesta.ok) {
			brand = marcaDesdeConfig(await respuesta.json());
			vida = CACHE_MS;
		}
	} catch {
		// Falla abierto, y se cachea igual, aunque menos: si admin-api está caído
		// no se le pregunta en cada petición.
	}

	if (cache.size >= MAX_ENTRADAS) cache.clear();
	cache.set(host, { brand, expira: ahora() + vida });
	return brand;
}

/** Solo para tests. */
export function _vaciarCache() {
	cache.clear();
}
