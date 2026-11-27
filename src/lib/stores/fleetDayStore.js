import { writable } from 'svelte/store';
import { EnConstruccionError } from '$lib/services/fleetDayService.js';

/** Cada cuánto se refresca el día de la flota mientras la pestaña está visible. */
export const FLEET_DAY_REFRESH_MS = 5 * 60_000;

/**
 * @typedef {{
 *   status: 'idle' | 'loading' | 'ready' | 'error' | 'en_construccion',
 *   data: any,
 *   error: string | null,
 *   refreshing: boolean
 * }} FleetDayState
 */

/** @type {FleetDayState} */
const INITIAL = { status: 'idle', data: null, error: null, refreshing: false };

/** @type {import('svelte/store').Writable<FleetDayState>} */
export const fleetDay = writable({ ...INITIAL });

/**
 * Refresco periódico del día de la flota. Las dependencias entran por
 * parámetro para poder probarlo sin red, sin reloj y sin `document`.
 *
 * - Una sola petición en vuelo: si un refresco aún no termina, el siguiente se salta.
 * - Pestaña oculta: no se pide nada. Al volver, se refresca si los datos son viejos.
 * - Un fallo conserva los últimos datos buenos (status `error` con `data` intacta).
 *
 * @param {{
 *   load: () => Promise<any>,
 *   store?: import('svelte/store').Writable<FleetDayState>,
 *   intervalMs?: number,
 *   now?: () => number,
 *   schedule?: (fn: () => void, ms: number) => unknown,
 *   cancel?: (handle: unknown) => void,
 *   doc?: { visibilityState?: string, addEventListener?: Function, removeEventListener?: Function } | null
 * }} deps
 */
export function createFleetDayController({
	load,
	store = fleetDay,
	intervalMs = FLEET_DAY_REFRESH_MS,
	now = () => Date.now(),
	schedule = (fn, ms) => setInterval(fn, ms),
	cancel = (h) => clearInterval(/** @type {any} */ (h)),
	doc = typeof document === 'undefined' ? null : document
}) {
	/** @type {unknown} */
	let timer = null;
	let inFlight = false;
	let lastLoadedAt = 0;
	let stopped = true;

	const visible = () => !doc || doc.visibilityState !== 'hidden';

	async function refresh() {
		if (inFlight) return;
		inFlight = true;
		store.update((s) => ({
			...s,
			status: s.data ? s.status : 'loading',
			refreshing: true
		}));
		try {
			const data = await load();
			if (stopped) return;
			lastLoadedAt = now();
			store.set({ status: 'ready', data, error: null, refreshing: false });
		} catch (err) {
			if (stopped) return;
			if (err instanceof EnConstruccionError) {
				store.set({ status: 'en_construccion', data: null, error: null, refreshing: false });
			} else {
				const message = err instanceof Error ? err.message : String(err);
				store.update((s) => ({ ...s, status: 'error', error: message, refreshing: false }));
			}
		} finally {
			inFlight = false;
		}
	}

	function onVisibility() {
		if (visible() && now() - lastLoadedAt >= intervalMs) refresh();
	}

	return {
		refresh,
		start() {
			if (!stopped) return;
			stopped = false;
			refresh();
			timer = schedule(() => {
				if (visible()) refresh();
			}, intervalMs);
			doc?.addEventListener?.('visibilitychange', onVisibility);
		},
		stop() {
			stopped = true;
			if (timer != null) cancel(timer);
			timer = null;
			doc?.removeEventListener?.('visibilitychange', onVisibility);
		}
	};
}
