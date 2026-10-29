import { appleAppSiteAssociation } from '$lib/appLinks.js';

/**
 * iOS lo descarga (vía la CDN de Apple) al instalar la app, y con él decide qué
 * rutas de este dominio abren INexus. Tiene que ser JSON, sin redirección y sin
 * extensión en la ruta.
 * @type {import('./$types').RequestHandler}
 */
export function GET() {
	return new Response(JSON.stringify(appleAppSiteAssociation()), {
		headers: {
			'content-type': 'application/json',
			'cache-control': 'public, max-age=3600'
		}
	});
}
