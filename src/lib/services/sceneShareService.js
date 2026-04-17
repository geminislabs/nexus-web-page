import { get } from 'svelte/store';
import { geofences, geofenceActions } from '$lib/stores/geofenceStore.js';
import { showH3Grid, selectedH3Cells, h3Resolution, h3Actions } from '$lib/stores/h3Store.js';
import { mapService } from '$lib/services/mapService.js';
import { geofenceService } from '$lib/services/geofenceService.js';
import { withGeofenceDbRow } from '$lib/utils/geofenceDbMapper.js';

export const MAP_SCENE_TYPE = 'nexus-map-scene';
export const MAP_SCENE_VERSION = 1;

/**
 * Construye el JSON exportable: vista del mapa, geocercas y selección H3.
 */
export function buildMapScene() {
	const view = mapService.getViewSnapshot();
	return {
		type: MAP_SCENE_TYPE,
		version: MAP_SCENE_VERSION,
		exportedAt: new Date().toISOString(),
		view: view || null,
		geofences: get(geofences),
		h3: {
			selectedCells: get(selectedH3Cells),
			showGrid: get(showH3Grid),
			resolution: get(h3Resolution)
		}
	};
}

function clampResolution(n) {
	const x = Number(n);
	if (!Number.isFinite(x)) return 8;
	return Math.min(11, Math.max(5, Math.round(x)));
}

function validateGeofenceItem(item) {
	return (
		item &&
		typeof item.id === 'string' &&
		typeof item.type === 'string' &&
		item.geometry &&
		typeof item.geometry === 'object'
	);
}

/**
 * Aplica una escena pegada o importada desde archivo.
 * @param {unknown} raw
 */
export function applyMapScene(raw) {
	if (!raw || typeof raw !== 'object') throw new Error('JSON inválido');
	const payload = /** @type {any} */ (raw);
	if (payload.type !== MAP_SCENE_TYPE) throw new Error('No es una escena Nexus (falta type nexus-map-scene)');

	geofenceService.cancelPending();
	geofenceActions.closeDraft();
	geofenceService.clearAll();

	const list = Array.isArray(payload.geofences) ? payload.geofences : [];
	const cleaned = list.filter(validateGeofenceItem).map(withGeofenceDbRow);
	geofenceActions.setGeofences(cleaned);
	geofenceService.restoreOverlays(cleaned);

	const h3 = payload.h3 && typeof payload.h3 === 'object' ? payload.h3 : {};
	if (typeof h3.showGrid === 'boolean') {
		h3Actions.setGridVisibility(h3.showGrid);
	}
	h3Actions.setResolution(clampResolution(h3.resolution));
	if (Array.isArray(h3.selectedCells)) {
		h3Actions.setSelectedCells(h3.selectedCells);
	} else {
		h3Actions.clearSelection();
	}

	if (payload.view && typeof payload.view === 'object') {
		mapService.applyViewSnapshot(payload.view);
	}

	requestAnimationFrame(() => {
		mapService.resizeMap();
	});
}
