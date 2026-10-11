import { installNodeErrorCapture, reportUnhandled } from '$lib/observability/capture.js';
import { recordHttpServer } from '$lib/observability/http.js';
import { init } from '$lib/observability/index.js';
import { scrubUrl } from '$lib/observability/scrubber.js';

await init();
installNodeErrorCapture();

const CSP = [
	"default-src 'self'",
	"base-uri 'self'",
	"object-src 'none'",
	"frame-ancestors 'none'",
	"img-src 'self' data: blob: https:",
	"font-src 'self' data:",
	"style-src 'self' 'unsafe-inline'",
	"script-src 'self' 'unsafe-inline' https://maps.googleapis.com https://maps.gstatic.com",
	"connect-src 'self' https: wss: http: ws:",
	"worker-src 'self' blob:"
].join('; ');

/**
 * Cabeceras de seguridad que ya tenía el handle. Se conservan en todas las rutas,
 * incluido el proxy OTLP. CSP sigue en Report-Only para no romper Maps/WS.
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

	// Share links: no filtrar token por Referer a terceros.
	// El route id es `/share/[token]`; el token no entra a la métrica.
	const pathname = event?.url?.pathname ?? '';
	if (pathname.startsWith('/share/')) {
		response.headers.set('Referrer-Policy', 'no-referrer');
	}

	response.headers.set('Content-Security-Policy-Report-Only', CSP);
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

/** @type {import('@sveltejs/kit').Handle} */
export async function handle({ event, resolve }) {
	const pathname = event?.url?.pathname ?? '';
	if (pathname.startsWith('/internal/otlp')) {
		return applySecurityHeaders(event, await resolve(event));
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
