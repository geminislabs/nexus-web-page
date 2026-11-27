import { writable } from 'svelte/store';

/**
 * Vista del seguimiento en escritorio, elegida por el usuario:
 *
 * - `clasica`: la de siempre (cajones, panel flotante de la unidad, campana).
 *   Es la vista por defecto.
 * - `panel`: la redistribución con columna de flota, columna de alertas y la
 *   franja del día, con los colores neutros. Cada panel se enciende o apaga.
 *
 * Las dos conviven en producción para validarlas con usuarios; la que no se
 * quede se retira. La preferencia vive en este navegador (no hay backend de
 * preferencias por usuario todavía). En móvil siempre se usa la clásica.
 */

export const TRACKING_VIEW_KEY = 'nexus.seguimiento.vista';
/** @typedef {'clasica' | 'panel'} TrackingViewName */
/** @typedef {{ flota: boolean, alertas: boolean, hoy: boolean, reticula: boolean }} TrackingPanels */
/** @typedef {{ view: TrackingViewName, panels: TrackingPanels }} TrackingViewPrefs */

/** @type {TrackingPanels} */
/** `reticula`: cuadrícula tenue sobre el mapa con las coordenadas del centro (apagada). */
export const DEFAULT_PANELS = Object.freeze({
	flota: true,
	alertas: true,
	hoy: true,
	reticula: false
});

/** @returns {TrackingViewPrefs} */
export function defaultPrefs() {
	return { view: 'clasica', panels: { ...DEFAULT_PANELS } };
}

/**
 * Lee la preferencia guardada; cualquier cosa rara vuelve al valor por defecto.
 * @param {string | null | undefined} raw
 * @returns {TrackingViewPrefs}
 */
export function parsePrefs(raw) {
	const base = defaultPrefs();
	if (!raw) return base;
	try {
		const data = JSON.parse(raw);
		const view = data?.view === 'panel' ? 'panel' : 'clasica';
		const panels = { ...base.panels };
		for (const k of /** @type {(keyof TrackingPanels)[]} */ (Object.keys(panels))) {
			if (typeof data?.panels?.[k] === 'boolean') panels[k] = data.panels[k];
		}
		return { view, panels };
	} catch {
		return base;
	}
}

/**
 * @param {{ getItem: (k: string) => string | null, setItem: (k: string, v: string) => void } | null} storage
 */
export function createTrackingViewStore(storage) {
	let initial = defaultPrefs();
	try {
		initial = parsePrefs(storage?.getItem(TRACKING_VIEW_KEY));
	} catch {
		// Almacenamiento bloqueado: valores por defecto.
	}
	const store = writable(initial);

	/** @param {(p: TrackingViewPrefs) => TrackingViewPrefs} fn */
	function update(fn) {
		store.update((p) => {
			const next = fn(p);
			try {
				storage?.setItem(TRACKING_VIEW_KEY, JSON.stringify(next));
			} catch {
				// Sin almacenamiento: dura lo que la pestaña.
			}
			return next;
		});
	}

	return {
		subscribe: store.subscribe,
		/** @param {TrackingViewName} view */
		setView(view) {
			update((p) => ({ ...p, view: view === 'panel' ? 'panel' : 'clasica' }));
		},
		/** @param {keyof TrackingPanels} panel @param {boolean} on */
		setPanel(panel, on) {
			if (!(panel in DEFAULT_PANELS)) return;
			update((p) => ({ ...p, panels: { ...p.panels, [panel]: !!on } }));
		},
		/** @param {keyof TrackingPanels} panel */
		togglePanel(panel) {
			if (!(panel in DEFAULT_PANELS)) return;
			update((p) => ({ ...p, panels: { ...p.panels, [panel]: !p.panels[panel] } }));
		}
	};
}

function browserStorage() {
	try {
		return typeof localStorage === 'undefined' ? null : localStorage;
	} catch {
		return null;
	}
}

export const trackingView = createTrackingViewStore(browserStorage());
