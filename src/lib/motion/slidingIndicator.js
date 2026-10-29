/**
 * Indicador que se desliza hasta la pestaña activa (FLIP medido a mano).
 *
 * Se usa en el contenedor de un `role="tablist"`, que debe tener
 * `position: relative`. Busca el hijo con `aria-selected="true"` y mueve
 * hasta él una pieza decorativa que la acción inserta al principio, así que
 * se pinta debajo de los botones (que deben ser `relative`).
 *
 *   use:slidingIndicator={{ active: tab, class: 'rounded-xl bg-blue-100' }}
 *   use:slidingIndicator={{ active: tab, edge: 'top', inset: 24, class: 'h-[3px] bg-sky-500' }}
 *
 * `active` sólo sirve para que Svelte llame a `update` cuando cambia.
 */
import { DURATION, EASE_CSS_OUT, motionDuration } from './index.js';

/**
 * @typedef {{ active?: unknown, class?: string, edge?: 'top' | null, inset?: number }} IndicatorParams
 */

/**
 * @param {HTMLElement} node
 * @param {IndicatorParams} [params]
 */
export function slidingIndicator(node, params = {}) {
	let opts = params;
	const indicator = document.createElement('span');
	indicator.setAttribute('aria-hidden', 'true');
	indicator.dataset.slidingIndicator = '';
	indicator.className = `pointer-events-none absolute left-0 top-0 ${opts.class ?? ''}`;
	indicator.style.opacity = '0';
	indicator.style.transitionProperty = 'transform, width, height, opacity';
	indicator.style.transitionTimingFunction = EASE_CSS_OUT;
	node.prepend(indicator);

	let placed = false;
	/** @type {number | null} */
	let frame = null;

	/** @param {boolean} animate */
	function place(animate) {
		const el = /** @type {HTMLElement | null} */ (node.querySelector('[aria-selected="true"]'));
		if (!el) {
			indicator.style.opacity = '0';
			placed = false;
			return;
		}
		// La primera vez aparece ya en su sitio; deslizarse desde (0,0) confunde.
		const ms = animate && placed ? motionDuration(DURATION.base) : 0;
		indicator.style.transitionDuration = `${ms}ms`;
		const inset = opts.inset ?? 0;
		if (opts.edge === 'top') {
			indicator.style.width = `${Math.max(0, el.offsetWidth - inset * 2)}px`;
			indicator.style.transform = `translate(${el.offsetLeft + inset}px, ${el.offsetTop}px)`;
		} else {
			indicator.style.width = `${el.offsetWidth}px`;
			indicator.style.height = `${el.offsetHeight}px`;
			indicator.style.transform = `translate(${el.offsetLeft}px, ${el.offsetTop}px)`;
		}
		indicator.style.opacity = '1';
		placed = true;
	}

	/** @param {boolean} animate */
	function schedule(animate) {
		if (frame !== null) cancelAnimationFrame(frame);
		// Espera a que Svelte pinte el nuevo aria-selected.
		frame = requestAnimationFrame(() => {
			frame = null;
			place(animate);
		});
	}

	schedule(false);
	const resize =
		typeof ResizeObserver === 'function' ? new ResizeObserver(() => schedule(false)) : null;
	resize?.observe(node);

	return {
		/** @param {IndicatorParams} next */
		update(next = {}) {
			opts = next;
			indicator.className = `pointer-events-none absolute left-0 top-0 ${opts.class ?? ''}`;
			schedule(true);
		},
		destroy() {
			if (frame !== null) cancelAnimationFrame(frame);
			resize?.disconnect();
			indicator.remove();
		}
	};
}
