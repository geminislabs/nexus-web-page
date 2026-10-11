/**
 * Política CSP del panel, en formato de `kit.csp.directives`.
 *
 * Se arma en build a partir de las mismas `VITE_*` que hornean las URLs de las
 * APIs: `connect-src` acepta exactamente los orígenes a los que el bundle va a
 * llamar, y nada más. Si una URL falta en el build, su origen no entra y la
 * llamada se bloquea — el mismo síntoma que tendría sin CSP, porque el bundle
 * tampoco sabría a dónde llamar.
 *
 * `script-src` no lleva `'unsafe-inline'`: SvelteKit añade un nonce por
 * petición a sus scripts y al del tema en `app.html` (`%sveltekit.nonce%`).
 * `style-src` sí lo conserva: Svelte y Google Maps escriben estilos inline.
 *
 * Google Fonts queda fuera a propósito: Maps pide Roboto y se le niega; el mapa
 * usa la fuente del sistema y el navegador no le pasa la IP del usuario a Google
 * por una tipografía.
 */

/** Hosts de Google Maps JS API (scripts, tiles, gen_204, Street View). */
const GOOGLE_MAPS = [
	'https://maps.googleapis.com',
	'https://*.googleapis.com',
	'https://maps.gstatic.com',
	'https://*.gstatic.com',
	'https://*.ggpht.com'
];

/**
 * `@iconify/svelte` descarga cada ícono en tiempo de ejecución. Los dos últimos
 * son los respaldos que prueba si el primero no responde.
 */
const ICONIFY = [
	'https://api.iconify.design',
	'https://api.simplesvg.com',
	'https://api.unisvg.com'
];

/**
 * Origen de una URL de la configuración, o `null` si no es una URL http(s).
 * @param {string | undefined} raw
 * @returns {URL | null}
 */
function parseHttpUrl(raw) {
	const value = String(raw ?? '').trim();
	if (!value) return null;
	try {
		const url = new URL(value);
		return url.protocol === 'http:' || url.protocol === 'https:' ? url : null;
	} catch {
		return null;
	}
}

/**
 * Orígenes a los que el navegador habla: las dos APIs y el WebSocket de
 * posiciones, que se deriva de `VITE_COMM_API_URL` cambiando el esquema.
 * @param {Record<string, string | undefined>} env
 * @returns {string[]}
 */
export function apiOrigins(env) {
	const origins = new Set();

	for (const key of ['VITE_API_BASE_URL', 'VITE_ADMIN_API_URL']) {
		const url = parseHttpUrl(env[key]);
		if (url) origins.add(url.origin);
	}

	const comm = parseHttpUrl(env.VITE_COMM_API_URL);
	if (comm) {
		origins.add(comm.origin);
		origins.add(`${comm.protocol === 'https:' ? 'wss:' : 'ws:'}//${comm.host}`);
	}

	return [...origins];
}

/**
 * @param {Record<string, string | undefined>} env variables `VITE_*` del build
 */
export function cspDirectives(env) {
	return {
		'default-src': ['self'],
		'base-uri': ['self'],
		'object-src': ['none'],
		'frame-ancestors': ['none'],
		'form-action': ['self'],
		'img-src': ['self', 'data:', 'blob:', 'https:'],
		'font-src': ['self', 'data:'],
		'style-src': ['self', 'unsafe-inline'],
		'script-src': ['self', ...GOOGLE_MAPS],
		'connect-src': ['self', ...apiOrigins(env), ...GOOGLE_MAPS, ...ICONIFY],
		'worker-src': ['self', 'blob:'],
		// Las violaciones llegan a stdout (`src/routes/internal/csp-report`).
		'report-uri': ['/internal/csp-report']
	};
}
