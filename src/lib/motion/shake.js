/**
 * Sacudida corta de un campo o aviso con error, además del texto rojo.
 * Sacude al montarse con un error (el aviso que aparece) y cuando un campo
 * pasa de no tener error a tenerlo. Si sólo cambia el texto del error no
 * vuelve a sacudir: mientras se escribe sería una sacudida por tecla.
 *
 *   use:shakeOn={error}
 */
import { motionDuration } from './index.js';

export const SHAKE_MS = 380;

const KEYFRAMES = [0, -6, 6, -4, 4, -2, 0].map((x) => ({ transform: `translateX(${x}px)` }));

/** @param {HTMLElement} node */
function shake(node) {
	const duration = motionDuration(SHAKE_MS);
	if (!duration || typeof node.animate !== 'function') return null;
	return node.animate(KEYFRAMES, { duration, easing: 'ease-out' });
}

/**
 * @param {HTMLElement} node
 * @param {unknown} trigger el error; vacío o falso no sacude
 */
export function shakeOn(node, trigger) {
	let last = trigger;
	let running = trigger ? shake(node) : null;

	return {
		/** @param {unknown} next */
		update(next) {
			const appeared = Boolean(next) && !last;
			last = next;
			if (!appeared) return;
			running?.cancel();
			running = shake(node);
		},
		destroy() {
			running?.cancel();
		}
	};
}
