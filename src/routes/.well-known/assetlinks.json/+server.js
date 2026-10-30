import { androidAssetLinks } from '$lib/appLinks.js';

/**
 * Android lo descarga al instalar la app (por el `autoVerify` del manifest) y,
 * si la huella coincide, abre los enlaces de este dominio en NEXUS sin
 * preguntar. Tiene que ser JSON y sin redirección.
 * @type {import('./$types').RequestHandler}
 */
export function GET() {
	return new Response(JSON.stringify(androidAssetLinks()), {
		headers: {
			'content-type': 'application/json',
			'cache-control': 'public, max-age=3600'
		}
	});
}
