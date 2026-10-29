/**
 * Transición entre rutas con la View Transitions API, para `onNavigate`.
 * El navegador hace un fundido cruzado entre la página anterior y la nueva.
 * Sin soporte o con movimiento reducido, se navega como siempre.
 */
import { reducedMotion } from './index.js';

/**
 * @param {import('@sveltejs/kit').OnNavigate} navigation
 * @returns {Promise<void> | undefined}
 */
export function routeTransition(navigation) {
	const doc = /** @type {any} */ (document);
	if (typeof doc.startViewTransition !== 'function' || reducedMotion()) return;
	// Cambios de query o hash en la misma página no son "otra pantalla".
	if (navigation.from?.url.pathname === navigation.to?.url.pathname) return;

	return new Promise((resolve) => {
		doc.startViewTransition(async () => {
			resolve();
			await navigation.complete;
		});
	});
}
