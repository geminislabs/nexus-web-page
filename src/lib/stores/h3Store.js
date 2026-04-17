import { derived, writable } from 'svelte/store';

const DEFAULT_RESOLUTION = 8;

export const showH3Grid = writable(false);
/** @type {import('svelte/store').Writable<string[]>} */
export const selectedH3Cells = writable([]);
export const h3Resolution = writable(DEFAULT_RESOLUTION);
export const renderedH3Cells = writable(0);

export const selectedH3Count = derived(selectedH3Cells, ($cells) => $cells.length);
export const hasSelectedH3Cell = derived(selectedH3Cells, ($cells) => $cells.length > 0);

export const h3Actions = {
	toggleGrid() {
		showH3Grid.update((visible) => !visible);
	},
	setGridVisibility(visible) {
		showH3Grid.set(visible);
	},
	setResolution(resolution) {
		h3Resolution.set(resolution);
	},

	toggleCell(h3Index) {
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
	reset() {
		showH3Grid.set(false);
		selectedH3Cells.set([]);
		h3Resolution.set(DEFAULT_RESOLUTION);
		renderedH3Cells.set(0);
	}
};
