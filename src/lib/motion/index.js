/**
 * Base común de animación del panel: duraciones, curvas, escalonado y
 * transiciones que respetan `prefers-reduced-motion`.
 *
 * Las transiciones de `svelte/transition` no miran esa preferencia por su
 * cuenta; las de este módulo sí, devolviendo duración 0 cuando está activa.
 */
import { fly, fade, scale } from 'svelte/transition';
import { flip } from 'svelte/animate';
import { backOut, cubicOut, cubicInOut, quintOut } from 'svelte/easing';
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
 * Entrada de una vista nueva (pestaña, sección, subpanel): aparece
 * desenfocada y se enfoca mientras sube un poco. Pensada para usarse sólo
 * como `in:` dentro de `{#key vista}`, así la vista anterior se va al
 * instante y no se apilan las dos en el layout.
 * @param {Element} _node
 * @param {{ delay?: number, duration?: number, blur?: number, y?: number }} [params]
 */
export function viewEnter(_node, { delay = 0, duration = 280, blur = 6, y = 6 } = {}) {
	if (reducedMotion()) return { delay: 0, duration: 0 };
	return {
		delay,
		duration,
		easing: EASE.out,
		css: (/** @type {number} */ t, /** @type {number} */ u) =>
			`opacity: ${t}; filter: blur(${u * blur}px); transform: translateY(${u * y}px);`
	};
}

/**
 * FLIP para `animate:` en listas con clave: cuando una fila cambia de lugar
 * (llega una alarma arriba, se filtra la lista) se desliza en vez de saltar.
 * @param {Element} node
 * @param {{ from: DOMRect, to: DOMRect }} fromTo
 */
export function flipList(node, fromTo) {
	return flip(node, fromTo, { duration: motionDuration(DURATION.base), easing: EASE.out });
}

/**
 * Apertura de un diálogo: crece un poco desde el centro mientras aparece.
 * Sirve también de salida (`transition:`), en reversa.
 * @param {Element} node
 * @param {{ duration?: number, start?: number }} [params]
 */
export function dialogScale(node, { duration = DURATION.base, start = 0.96 } = {}) {
	if (reducedMotion()) return { delay: 0, duration: 0 };
	return scale(node, { duration, start, opacity: 0, easing: EASE.out });
}

/**
 * Rebote de un contador que acaba de subir (badge de notificaciones): crece
 * pasándose un poco de su tamaño y vuelve. Pensado para `in:` dentro de un
 * `{#key}` que sólo cambia cuando el número aumenta.
 * @param {Element} _node
 * @param {{ duration?: number, from?: number }} [params]
 */
export function pop(_node, { duration = 420, from = 0.55 } = {}) {
	if (reducedMotion()) return { delay: 0, duration: 0 };
	return {
		duration,
		css: (/** @type {number} */ t) =>
			`transform: scale(${Number((from + (1 - from) * backOut(t)).toFixed(4))});`
	};
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

/**
 * Entrada de un paso de asistente: llega desde el lado hacia el que se
 * avanza (`direction` 1 = siguiente, -1 = anterior). Pensada para `in:`
 * dentro de `{#key paso}`, igual que `viewEnter`.
 * @param {Element} _node
 * @param {{ direction?: number, distance?: number, duration?: number }} [params]
 */
export function stepSlide(_node, { direction = 1, distance = 24, duration = 260 } = {}) {
	if (reducedMotion()) return { delay: 0, duration: 0 };
	const dx = Math.sign(direction || 1) * distance;
	return {
		duration,
		easing: EASE.out,
		css: (/** @type {number} */ t, /** @type {number} */ u) =>
			`opacity: ${t}; transform: translateX(${u * dx}px);`
	};
}

/**
 * Fase de una respiración suave: 0 → 1 → 0 cada `periodMs`, empezando y
 * terminando quieta (coseno). Para pulsos que se dibujan a mano, como el
 * marcador resaltado del mapa.
 * @param {number} elapsedMs
 * @param {number} [periodMs]
 */
export function breathe(elapsedMs, periodMs = 1600) {
	const t = (Math.max(0, Number(elapsedMs) || 0) % periodMs) / periodMs;
	return Number(((1 - Math.cos(t * 2 * Math.PI)) / 2).toFixed(4));
}
