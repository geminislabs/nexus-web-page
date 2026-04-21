import * as h3 from 'h3-js';
import * as turf from '@turf/turf';

/**
 * Proyección mínima al objeto geofence.
 *
 * @param {object} zone - { id, name, cells: string[], metadata? }
 * @param {string} [fallbackDeviceId]
 * @returns {{ geofence_id: string, device_id: string, name: string, type: string, latitude: number, longitude: number, radius: number, status: string, h3_cells?: string[] }}
 */
export function toGeofenceRowFromH3Zone(zone, fallbackDeviceId = '') {
	const meta = zone?.metadata && typeof zone.metadata === 'object' ? zone.metadata : {};
	const device_id = String(
		meta.device_id || meta.deviceId || fallbackDeviceId || 'UNASSIGNED'
	).slice(0, 100);
	const geofence_id = String(zone?.id || '').slice(0, 100);
	const name = String(zone?.name || 'Zona H3').slice(0, 255);
	const dbType = meta.alertType === 'outside' || meta.alertType === 'exit' ? 'outside' : 'inside';
	const status = meta.status === 'inactive' ? 'inactive' : 'active';
	const cells = Array.isArray(zone?.cells)
		? zone.cells.filter((c) => typeof c === 'string' && c.length)
		: [];
	const { latitude, longitude, radius } = deriveLatLngRadiusFromH3Cells(cells);

	return {
		geofence_id,
		device_id,
		name,
		type: dbType,
		latitude: roundCoord(latitude),
		longitude: roundCoord(longitude),
		radius: clampRadius(radius),
		status,
		h3_cells: cells
	};
}

/** Asegura coherente con las celdas y metadata actuales. */
export function withZoneDbRow(zone) {
	if (!zone || typeof zone !== 'object') return zone;
	return { ...zone, dbRow: toGeofenceRowFromH3Zone(zone, zone.metadata?.device_id ?? '') };
}

function roundCoord(n) {
	const x = Number(n);
	if (!Number.isFinite(x)) return 0;
	return Math.round(x * 1e8) / 1e8;
}

function clampRadius(r) {
	const x = Number(r);
	if (!Number.isFinite(x) || x < 1) return 1;
	if (x > 99999999.99) return 99999999.99;
	return Math.round(x * 100) / 100;
}

function deriveLatLngRadiusFromH3Cells(cells) {
	if (!cells.length) return { latitude: 0, longitude: 0, radius: 100 };

	const pts = [];
	for (const cell of cells) {
		try {
			const [lat, lng] = h3.cellToLatLng(cell);
			if (Number.isFinite(lat) && Number.isFinite(lng)) {
				pts.push(turf.point([lng, lat]));
			}
		} catch {
			// celda inválida: omitir
		}
	}

	if (pts.length === 0) return { latitude: 0, longitude: 0, radius: 100 };
	if (pts.length === 1) {
		const [lng, lat] = pts[0].geometry.coordinates;
		return { latitude: lat, longitude: lng, radius: 150 };
	}

	const collection = turf.featureCollection(pts);
	const centroid = turf.center(collection);
	const [lngC, latC] = centroid.geometry.coordinates;

	let maxD = 0;
	for (const p of pts) {
		const d = turf.distance(centroid, p, { units: 'meters' });
		if (d > maxD) maxD = d;
	}

	return {
		latitude: latC,
		longitude: lngC,
		radius: Math.max(50, Math.round(maxD * 1.15 * 100) / 100)
	};
}
