/**
 * Base común de animación del panel: duraciones, curvas, escalonado y
 * transiciones que respetan `prefers-reduced-motion`.
 *
 * Las transiciones de `svelte/transition` no miran esa preferencia por su
 * cuenta; las de este módulo sí, devolviendo duración 0 cuando está activa.
 */
import { fly, fade } from 'svelte/transition';
import { cubicOut, cubicInOut, quintOut } from 'svelte/easing';
import { prefersReducedMotion } from 'svelte/motion';

export const DURATION = Object.freeze({ fast: 150, base: 250, slow: 450 });

export const EASE = Object.freeze({ out: cubicOut, inOut: cubicInOut, emphasized: quintOut });

/** Equivalente CSS de `EASE.out`, para `element.animate()` y estilos. */
export const EASE_CSS_OUT = 'cubic-bezier(0.33, 1, 0.68, 1)';

/** @returns {boolean} */
export function reducedMotion() {
	return prefersReducedMotion.current === true;
}

/**
 * Duración efectiva: 0 si el usuario pidió reducir el movimiento.
 * @param {number} ms
 */
export function motionDuration(ms) {
	return reducedMotion() ? 0 : ms;
}

/**
 * Retraso del elemento `index` en una entrada escalonada. Se topa en `max`
 * pasos para que una lista larga no tarde segundos en terminar de aparecer.
 * @param {number} index
 * @param {{ step?: number, max?: number }} [opts]
 */
export function staggerDelay(index, { step = 35, max = 8 } = {}) {
	const i = Math.max(0, Math.floor(Number(index) || 0));
	return Math.min(i, max) * step;
}

/**
 * Entrada con fundido y desplazamiento hacia arriba. Pensada para `in:` en
 * elementos de lista: `in:rise={{ delay: staggerDelay(i) }}`.
 * @param {Element} node
 * @param {{ delay?: number, duration?: number, y?: number }} [params]
 */
export function rise(node, { delay = 0, duration = DURATION.base, y = 8 } = {}) {
	if (reducedMotion()) return { delay: 0, duration: 0 };
	return fly(node, { delay, duration, y, easing: EASE.out });
}

/**
 * Fundido que respeta la preferencia de movimiento reducido.
 * @param {Element} node
 * @param {{ delay?: number, duration?: number }} [params]
 */
export function softFade(node, { delay = 0, duration = DURATION.fast } = {}) {
	if (reducedMotion()) return { delay: 0, duration: 0 };
	return fade(node, { delay, duration });
}
