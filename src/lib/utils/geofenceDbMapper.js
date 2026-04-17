import * as turf from '@turf/turf';

/** Ensures `dbRow` exists for store/API alignment with `public.geofences`. */
export function withGeofenceDbRow(geofence) {
	if (geofence?.dbRow && typeof geofence.dbRow === 'object') return geofence;
	return { ...geofence, dbRow: toPostgresGeofenceRow(geofence, '') };
}

/**
 * Maps an in-app geofence object to the minimal PostgreSQL `public.geofences` row shape:
 * geofence_id, device_id, name, type ('inside' | 'outside'), latitude, longitude, radius, status.
 * Extra UI fields (color, full geometry) stay client-side; use `metadata` for device_id until API persists.
 *
 * @param {object} geofence - { id, name, type, geometry, metadata? }
 * @param {string} [fallbackDeviceId] - optional device id when not in metadata
 * @returns {{ geofence_id: string, device_id: string, name: string, type: string, latitude: number, longitude: number, radius: number, status: string }}
 */
export function toPostgresGeofenceRow(geofence, fallbackDeviceId = '') {
	const meta = geofence.metadata && typeof geofence.metadata === 'object' ? geofence.metadata : {};
	const device_id = String(meta.device_id || meta.deviceId || fallbackDeviceId || 'UNASSIGNED').slice(
		0,
		100
	);
	const geofence_id = String(geofence.id || '').slice(0, 100);
	const name = String(geofence.name || 'Geocerca').slice(0, 255);
	const dbType = meta.alertType === 'outside' || meta.alertType === 'exit' ? 'outside' : 'inside';
	const status = meta.status === 'inactive' ? 'inactive' : 'active';

	const { latitude, longitude, radius } = deriveLatLngRadius(geofence);

	return {
		geofence_id,
		device_id,
		name,
		type: dbType,
		latitude: roundCoord(latitude),
		longitude: roundCoord(longitude),
		radius: clampRadius(radius),
		status
	};
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

function deriveLatLngRadius(geofence) {
	const g = geofence.geometry;
	if (!g) return { latitude: 0, longitude: 0, radius: 100 };

	if (g.center && typeof g.center.lat === 'number' && typeof g.center.lng === 'number') {
		const radiusMeters = Math.max(1, Number(g.radiusMeters) || 100);
		return { latitude: g.center.lat, longitude: g.center.lng, radius: radiusMeters };
	}

	if (g.position && typeof g.position.lat === 'number' && typeof g.position.lng === 'number') {
		return { latitude: g.position.lat, longitude: g.position.lng, radius: 100 };
	}

	const coords = Array.isArray(g.coordinates)
		? g.coordinates.filter((p) => p && Number.isFinite(p.lat) && Number.isFinite(p.lng))
		: [];

	if (coords.length === 0) return { latitude: 0, longitude: 0, radius: 100 };

	const ring = coords.map((p) => [p.lng, p.lat]);
	const kind = geofence.type;

	try {
		if (kind === 'polyline' && ring.length >= 2) {
			const line = turf.lineString(ring);
			const c = turf.centroid(line);
			const [lng, lat] = c.geometry.coordinates;
			const len = turf.length(line, { units: 'meters' });
			return { latitude: lat, longitude: lng, radius: Math.max(50, len / 2) };
		}

		if (ring.length >= 3) {
			const closed = [...ring, ring[0]];
			const poly = turf.polygon([closed]);
			const c = turf.centroid(poly);
			const [lng, lat] = c.geometry.coordinates;
			const bboxPoly = turf.bboxPolygon(turf.bbox(poly));
			const sw = turf.point(bboxPoly.geometry.coordinates[0][0]);
			const ne = turf.point(bboxPoly.geometry.coordinates[0][2]);
			const d = turf.distance(sw, ne, { units: 'meters' });
			return { latitude: lat, longitude: lng, radius: Math.max(50, d / 2) };
		}

		if (ring.length === 2) {
			const [a, b] = ring;
			const midLat = (a[1] + b[1]) / 2;
			const midLng = (a[0] + b[0]) / 2;
			const d = turf.distance(turf.point(a), turf.point(b), { units: 'meters' });
			return { latitude: midLat, longitude: midLng, radius: Math.max(50, d / 2) };
		}

		const [lng, lat] = ring[0];
		return { latitude: lat, longitude: lng, radius: 100 };
	} catch {
		const [lng, lat] = ring[0];
		return { latitude: lat, longitude: lng, radius: 100 };
	}
}
