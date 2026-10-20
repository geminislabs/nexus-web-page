/**
 * La marca resuelta por Host en `hooks.server.js`, para que cada componente la
 * lea de `page.data.brand` desde el primer HTML.
 * @type {import('./$types').LayoutServerLoad}
 */
export function load({ locals }) {
	return { brand: locals.brand ?? null };
}
