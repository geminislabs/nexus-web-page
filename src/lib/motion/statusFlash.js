/**
 * Destello de una fila cuando cambia el estado de lo que muestra (una unidad
 * pasa de en línea a sin señal, por ejemplo), para notar el cambio sin estar
 * mirando la lista. No destella al montarse: sólo cuando `key` cambia.
 *
 *   use:statusFlash={{ key: status.kind, color: status.flash }}
 */
import { EASE_CSS_OUT, motionDuration } from './index.js';

export const STATUS_FLASH_MS = 1100;

/**
 * @typedef {{ key?: unknown, color?: string }} StatusFlashParams
 */

/**
 * @param {HTMLElement} node
 * @param {StatusFlashParams} [params]
 */
export function statusFlash(node, params = {}) {
	let last = params.key;
	/** @type {Animation | null} */
	let running = null;

	return {
		/** @param {StatusFlashParams} [next] */
		update(next = {}) {
			if (next.key === last) return;
			last = next.key;
			const duration = motionDuration(STATUS_FLASH_MS);
			if (!duration || !next.color || typeof node.animate !== 'function') return;
			running?.cancel();
			running = node.animate(
				[{ backgroundColor: next.color }, { backgroundColor: 'transparent' }],
				{ duration, easing: EASE_CSS_OUT }
			);
		},
		destroy() {
			running?.cancel();
		}
	};
}
