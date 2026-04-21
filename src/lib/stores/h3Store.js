import { derived, writable, get } from 'svelte/store';
import { areNeighborCells } from 'h3-js';

const DEFAULT_RESOLUTION = 8;
/** Resolución fija en el flujo móvil «Crear zona». */
export const MOBILE_ZONE_RESOLUTION = 7;

let _resolutionBeforeMobileZone = DEFAULT_RESOLUTION;

export const showH3Grid = writable(false);
/** @type {import('svelte/store').Writable<string[]>} */
export const selectedH3Cells = writable([]);
export const h3Resolution = writable(DEFAULT_RESOLUTION);
export const renderedH3Cells = writable(0);

/** Flujo mapa a pantalla completa: selección solo contigua y controles FAB. */
export const mobileZoneMapActive = writable(false);
/** Solo vista mapa «crear zona»: permite clicks */
export const mobileCrearZonaMapPassesPointer = writable(false);

/**
 * Flujo «crear/guardar zona» en escritorio con el drawer cerrado
 */
export const desktopZonePanelSubView = writable(
	/** @type {'zonas' | 'crear_zona_map' | 'guardar_zona'} */ ('zonas')
);

/** Mensaje breve tras guardar/borrar (persiste al desmontar el overlay de escritorio). */
export const zoneUiToast = writable('');

export function showZoneUiToast(msg, durationMs = 2600) {
	zoneUiToast.set(msg);
	setTimeout(() => zoneUiToast.set(''), durationMs);
}
/** Modo borrador: tap en hexágono seleccionado lo quita del conjunto. */
export const h3EraserMode = writable(false);
/** Aviso breve: hexágonos deben ser contiguos */
export const zoneCreateBanner = writable(/** @type {null | 'contiguous'} */ (null));

export const selectedH3Count = derived(selectedH3Cells, ($cells) => $cells.length);
export const hasSelectedH3Cell = derived(selectedH3Cells, ($cells) => $cells.length > 0);

/** @param {string[]} nodes */
function largestConnectedComponent(nodes) {
	const arr = [...new Set(nodes)];
	if (arr.length <= 1) return arr;
	let best = [];
	const seen = new Set();
	for (const start of arr) {
		if (seen.has(start)) continue;
		const stack = [start];
		const comp = [];
		while (stack.length) {
			const u = stack.pop();
			if (seen.has(u)) continue;
			seen.add(u);
			comp.push(u);
			for (const v of arr) {
				if (seen.has(v) || u === v) continue;
				try {
					if (areNeighborCells(u, v)) stack.push(v);
				} catch {
					// índices inválidos
				}
			}
		}
		if (comp.length > best.length) best = comp;
	}
	return best;
}

function flashContiguousWarning() {
	zoneCreateBanner.set('contiguous');
	setTimeout(() => {
		if (get(zoneCreateBanner) === 'contiguous') zoneCreateBanner.set(null);
	}, 3200);
}

export const h3Actions = {
	toggleGrid() {
		if (get(mobileZoneMapActive)) return;
		showH3Grid.update((visible) => !visible);
	},
	setGridVisibility(visible) {
		if (!visible && get(mobileZoneMapActive)) return;
		showH3Grid.set(visible);
	},
	setResolution(resolution) {
		if (get(mobileZoneMapActive)) return;
		h3Resolution.set(resolution);
	},

	toggleCell(h3Index) {
		if (get(mobileZoneMapActive)) return;
		selectedH3Cells.update((cells) => {
			const i = cells.indexOf(h3Index);
			if (i >= 0) {
				return cells.filter((_, j) => j !== i);
			}
			return [...cells, h3Index];
		});
	},
	/** Quita la última celda seleccionada */
	popLastSelection() {
		selectedH3Cells.update((cells) => {
			if (cells.length === 0) return cells;
			return cells.slice(0, -1);
		});
	},
	clearSelection() {
		selectedH3Cells.set([]);
	},

	setSelectedCells(cells) {
		if (!Array.isArray(cells)) {
			selectedH3Cells.set([]);
			return;
		}
		const out = [];
		const seen = new Set();
		for (const x of cells) {
			if (typeof x !== 'string' || !x.length) continue;
			if (seen.has(x)) continue;
			seen.add(x);
			out.push(x);
		}
		selectedH3Cells.set(out);
	},
	setRenderedCells(count) {
		renderedH3Cells.set(count);
	},

	setEraserMode(on) {
		h3EraserMode.set(!!on);
	},
	toggleEraserMode() {
		h3EraserMode.update((v) => !v);
	},

	enterMobileZoneMap() {
		_resolutionBeforeMobileZone = get(h3Resolution);
		h3EraserMode.set(false);
		h3Resolution.set(MOBILE_ZONE_RESOLUTION);
		selectedH3Cells.set([]);
		showH3Grid.set(true);
		zoneCreateBanner.set(null);
		mobileZoneMapActive.set(true);
	},
	exitMobileZoneMap() {
		mobileZoneMapActive.set(false);
		mobileCrearZonaMapPassesPointer.set(false);
		h3EraserMode.set(false);
		showH3Grid.set(false);
		selectedH3Cells.set([]);
		zoneCreateBanner.set(null);
		h3Resolution.set(_resolutionBeforeMobileZone);
	},

	tryAddContiguousCell(h3Index) {
		if (typeof h3Index !== 'string' || !h3Index) return;
		selectedH3Cells.update((cells) => {
			if (cells.includes(h3Index)) return cells;
			if (cells.length === 0) return [h3Index];
			let adjacent = false;
			for (const c of cells) {
				try {
					if (areNeighborCells(c, h3Index)) {
						adjacent = true;
						break;
					}
				} catch {
					// omitir
				}
			}
			if (!adjacent) {
				flashContiguousWarning();
				return cells;
			}
			return [...cells, h3Index];
		});
	},

	removeCellInZoneEditor(h3Index) {
		if (typeof h3Index !== 'string' || !h3Index) return;
		selectedH3Cells.update((cells) => {
			if (!cells.includes(h3Index)) return cells;
			const next = cells.filter((c) => c !== h3Index);
			if (next.length <= 1) return next;
			const cc = largestConnectedComponent(next);
			return cc;
		});
	},

	reset() {
		showH3Grid.set(false);
		selectedH3Cells.set([]);
		h3Resolution.set(DEFAULT_RESOLUTION);
		renderedH3Cells.set(0);
		mobileZoneMapActive.set(false);
		mobileCrearZonaMapPassesPointer.set(false);
		h3EraserMode.set(false);
		zoneCreateBanner.set(null);
	}
};
