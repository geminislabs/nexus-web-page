/**
 * Security headers para SvelteKit (defense in depth).
 * CSP empieza en Report-Only para no romper Maps/WS; endurecer cuando observability esté listo.
 */
/** @type {import('@sveltejs/kit').Handle} */
export async function handle({ event, resolve }) {
	const response = await resolve(event);

	response.headers.set('X-Content-Type-Options', 'nosniff');
	response.headers.set('X-Frame-Options', 'DENY');
	response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
	response.headers.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=(self)');
	response.headers.set('Cross-Origin-Opener-Policy', 'same-origin-allow-popups');

	// Share links: no filtrar token por Referer a terceros.
	if (event.url.pathname.startsWith('/share/')) {
		response.headers.set('Referrer-Policy', 'no-referrer');
	}

	// Report-Only: inventariar violaciones antes de enforce.
	const csp = [
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
	response.headers.set('Content-Security-Policy-Report-Only', csp);

	return response;
}
