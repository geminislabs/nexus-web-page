import { installNodeErrorCapture, reportUnhandled } from '$lib/observability/capture.js';
import { recordHttpServer } from '$lib/observability/http.js';
import { init } from '$lib/observability/index.js';
import { scrubUrl } from '$lib/observability/scrubber.js';
import { hostDeLaPeticion, resolverMarca } from '$lib/server/brand.js';
import { initNodeTracer } from '$lib/server/observability/nodeTracer.js';

await init({ serverTracer: initNodeTracer });
installNodeErrorCapture();

/**
 * Cabeceras de seguridad que ya tenía el handle. Se conservan en todas las rutas,
 * incluido el proxy OTLP. El CSP no va aquí: lo pone SvelteKit en cada página
 * (`kit.csp` en svelte.config.js) porque es quien conoce el nonce.
 * @param {import('@sveltejs/kit').RequestEvent} event
 * @param {Response} response
 */
function applySecurityHeaders(event, response) {
	if (!response?.headers || typeof response.headers.set !== 'function') return response;

	response.headers.set('X-Content-Type-Options', 'nosniff');
	response.headers.set('X-Frame-Options', 'DENY');
	response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
	response.headers.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=(self)');
	response.headers.set('Cross-Origin-Opener-Policy', 'same-origin-allow-popups');

	// Share links e invitaciones: no filtrar el token por Referer a terceros
	// (la App Store, en el caso de la invitación). Los route id son
	// `/share/[token]` e `/invite/[token]`; el token no entra a la métrica.
	const pathname = event?.url?.pathname ?? '';
	if (pathname.startsWith('/share/') || pathname.startsWith('/invite/')) {
		response.headers.set('Referrer-Policy', 'no-referrer');
	}

	return response;
}

/**
 * @param {import('@sveltejs/kit').RequestEvent} event
 */
function serverRoute(event) {
	try {
		if (event?.route?.id) return String(event.route.id);
		return scrubUrl(event?.url?.pathname ?? '') || 'unspecified';
	} catch {
		return 'unspecified';
	}
}

/** @type {import('@sveltejs/kit').HandleServerError} */
export function handleError({ error, message }) {
	reportUnhandled(error, 'sveltekit');
	return { message };
}

const API_BASE = (() => {
	const crudo = String(
		import.meta.env.VITE_API_BASE_URL || import.meta.env.VITE_ADMIN_API_URL || ''
	).replace(/\/+$/, '');
	if (!crudo) return 'http://localhost:8100/api/v1';
	return crudo.endsWith('/api/v1') ? crudo : `${crudo}/api/v1`;
})();

/** @type {import('@sveltejs/kit').Handle} */
export async function handle({ event, resolve }) {
	const pathname = event?.url?.pathname ?? '';
	if (pathname.startsWith('/internal/otlp')) {
		return applySecurityHeaders(event, await resolve(event));
	}

	// La marca del dominio por el que entró el navegador (§7). Solo apariencia:
	// nunca autoriza nada. Las rutas internas y las de `/.well-known/` no pintan HTML.
	// Nunca tumba la petición: sin marca se pinta la por defecto.
	if (!pathname.startsWith('/internal/') && !pathname.startsWith('/.well-known/') && event.locals) {
		try {
			event.locals.brand = await resolverMarca(hostDeLaPeticion(event.request, event.url), {
				apiBase: API_BASE
			});
		} catch {
			event.locals.brand = null;
		}
	}

	const start = Date.now();
	try {
		const response = await resolve(event);
		try {
			recordHttpServer({
				route: serverRoute(event),
				method: event.request.method,
				statusCode: response.status,
				durationMs: Date.now() - start
			});
		} catch {
			/* fail-open */
		}
		return applySecurityHeaders(event, response);
	} catch (error) {
		try {
			recordHttpServer({
				route: serverRoute(event),
				method: event.request.method,
				statusCode: 500,
				durationMs: Date.now() - start
			});
		} catch {
			/* fail-open */
		}
		throw error;
	}
}
