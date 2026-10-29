/**
 * Cambio de tema con un círculo que se expande desde el botón pulsado
 * (View Transitions API). Sin soporte del navegador, o con movimiento
 * reducido, el tema cambia al instante como antes.
 */
import { get } from 'svelte/store';
import { tick } from 'svelte';
import { theme, themeActions } from '$lib/stores/themeStore.js';
import { reducedMotion, DURATION, EASE_CSS_OUT } from './index.js';

/**
 * Centro del círculo: el puntero si el clic vino del ratón o del dedo, y el
 * centro del botón si vino del teclado (en ese caso clientX/Y valen 0).
 * @param {MouseEvent | undefined} event
 * @returns {{ x: number, y: number }}
 */
export function revealOrigin(event) {
	if (event && event.detail > 0 && (event.clientX || event.clientY)) {
		return { x: event.clientX, y: event.clientY };
	}
	const el = /** @type {Element | null} */ (event?.currentTarget ?? null);
	if (el && typeof el.getBoundingClientRect === 'function') {
		const r = el.getBoundingClientRect();
		return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
	}
	return { x: window.innerWidth / 2, y: window.innerHeight / 2 };
}

/**
 * Radio que cubre toda la ventana desde (x, y).
 * @param {number} x
 * @param {number} y
 */
export function revealRadius(x, y) {
	return Math.hypot(Math.max(x, window.innerWidth - x), Math.max(y, window.innerHeight - y));
}

/**
 * @param {MouseEvent | undefined} event
 * @param {() => void} apply cambia el tema en el DOM
 */
export function circleReveal(event, apply) {
	const doc = /** @type {any} */ (document);
	if (typeof doc.startViewTransition !== 'function' || reducedMotion()) {
		apply();
		return;
	}
	const { x, y } = revealOrigin(event);
	const r = revealRadius(x, y);
	const transition = doc.startViewTransition(async () => {
		apply();
		await tick();
	});
	transition.ready
		.then(() => {
			document.documentElement.animate(
				{ clipPath: [`circle(0px at ${x}px ${y}px)`, `circle(${r}px at ${x}px ${y}px)`] },
				{
					duration: DURATION.slow,
					easing: EASE_CSS_OUT,
					pseudoElement: '::view-transition-new(root)'
				}
			);
		})
		.catch(() => {});
}

/**
 * @param {'light' | 'dark'} next
 * @param {MouseEvent} [event]
 */
export function setThemeWithReveal(next, event) {
	if (get(theme) === next) return;
	circleReveal(event, () => themeActions.set(next));
}

/** @param {MouseEvent} [event] */
export function toggleThemeWithReveal(event) {
	setThemeWithReveal(get(theme) === 'dark' ? 'light' : 'dark', event);
}
