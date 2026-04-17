import { derived, get, writable } from 'svelte/store';
import { toPostgresGeofenceRow } from '$lib/utils/geofenceDbMapper.js';

export const geofences = writable([]);
export const activeGeofenceType = writable('polygon');
export const pendingGeofenceColor = writable('#10B981');
export const pendingGeofenceName = writable(''); // ← NUEVO
export const isDrawingGeofence = writable(false);
export const geofenceDraft = writable(null);

export const geofenceCount = derived(geofences, ($g) => $g.length);

/** Comparación de nombres */
export function normalizeGeofenceNameKey(name) {
	return String(name ?? '')
		.trim()
		.toLocaleLowerCase('es');
}

/**
 * @param {string} name Nombre a comprobar (tras trim en la comparación)
 * @param {string | null} [excludeId] Id de geocerca a ignorar (edición)
 * @returns {boolean} true si otra geocerca ya usa el mismo nombre (case insensitive)
 */
export function isGeofenceNameTaken(name, excludeId = null) {
	const key = normalizeGeofenceNameKey(name);
	if (!key) return false;
	return get(geofences).some(
		(g) => normalizeGeofenceNameKey(g.name) === key && (excludeId == null || g.id !== excludeId)
	);
}

export const geofenceActions = {
	setActiveType(type) {
		activeGeofenceType.set(type);
	},
	setPendingGeofenceColor(color) {
		if (typeof color === 'string') pendingGeofenceColor.set(color);
	},
	setPendingGeofenceName(name) {
		// ← NUEVO
		pendingGeofenceName.set(typeof name === 'string' ? name.trim() : '');
	},
	startDrawing() {
		isDrawingGeofence.set(true);
	},
	stopDrawing() {
		isDrawingGeofence.set(false);
	},
	openDraft(draft) {
		geofenceDraft.set(draft);
	},
	openEdit(geofence) {
		geofenceDraft.set({ mode: 'edit', geofence });
	},
	closeDraft() {
		geofenceDraft.set(null);
	},
	addGeofence(geofence) {
		geofences.update((items) => [...items, geofence]);
	},
	updateGeofence(id, patch) {
		geofences.update((items) =>
			items.map((item) => {
				if (item.id !== id) return item;
				// Merge patch into metadata si viene alertType o status
				const nextMeta = {
					...(item.metadata ?? {}),
					...(patch.metadata ?? {})
				};
				if (patch.alertType !== undefined) nextMeta.alertType = patch.alertType;
				if (patch.dbStatus !== undefined) nextMeta.status = patch.dbStatus;
				const next = { ...item, ...patch, metadata: nextMeta };
				// Eliminar claves auxiliares que no son del modelo
				delete next.alertType;
				delete next.dbStatus;
				// Recalcular dbRow
				next.dbRow = toPostgresGeofenceRow(next, next.metadata?.device_id ?? '');
				return next;
			})
		);
	},
	removeGeofence(id) {
		geofences.update((items) => items.filter((item) => item.id !== id));
	},
	setGeofences(items) {
		geofences.set(items);
	},
	clearGeofences() {
		geofences.set([]);
	},
	reset() {
		geofences.set([]);
		activeGeofenceType.set('polygon');
		pendingGeofenceColor.set('#10B981');
		pendingGeofenceName.set(''); // ← NUEVO
		isDrawingGeofence.set(false);
		geofenceDraft.set(null);
	}
};
