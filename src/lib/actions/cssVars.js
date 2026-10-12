import { isHexColor, safeCssVars } from '$lib/utils/brandForm.js';

/*
 * Acciones que pintan con colores de la marca por CSSOM (`style.setProperty`),
 * nunca con un atributo `style` en el HTML. El CSP no restringe el CSSOM, así
 * que la pantalla de marca no depende de que `style-src` siga admitiendo
 * `'unsafe-inline'` (B4, «Pantalla en Nexus»).
 */

/**
 * Escribe las variables `--color-brand-*` en el nodo y quita las que ya no
 * vengan. Solo nombres de ese prefijo y valores `#rrggbb` (`safeCssVars`).
 * @param {HTMLElement} node
 * @param {Record<string, string> | null | undefined} tokens
 */
export function brandVars(node, tokens) {
	/** @type {string[]} */
	let applied = [];

	/** @param {Record<string, string> | null | undefined} next */
	function apply(next) {
		const entries = safeCssVars(next);
		const names = new Set(entries.map(([name]) => name));
		for (const name of applied) {
			if (!names.has(name)) node.style.removeProperty(name);
		}
		for (const [name, value] of entries) node.style.setProperty(name, value);
		applied = [...names];
	}

	apply(tokens);
	return { update: apply };
}

/**
 * Fondo de un solo color, para las muestras de la rampa.
 * @param {HTMLElement} node
 * @param {string} color
 */
export function swatch(node, color) {
	/** @param {string} next */
	function apply(next) {
		if (isHexColor(next)) node.style.setProperty('background-color', next);
		else node.style.removeProperty('background-color');
	}
	apply(color);
	return { update: apply };
}
