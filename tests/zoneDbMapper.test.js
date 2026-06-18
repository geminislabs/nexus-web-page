import { describe, it, expect } from 'vitest';
import { toGeofenceRowFromH3Zone, withZoneDbRow } from '../src/lib/utils/zoneDbMapper.js';

describe('zoneDbMapper', () => {
	it('maps H3 zone metadata to geofence row', () => {
		const row = toGeofenceRowFromH3Zone({
			id: 'zone-1',
			name: 'Bodega',
			cells: ['8928308280fffff'],
			metadata: { device_id: 'dev-9', alertType: 'outside', status: 'inactive' }
		});
		expect(row).toMatchObject({
			geofence_id: 'zone-1',
			device_id: 'dev-9',
			name: 'Bodega',
			type: 'outside',
			status: 'inactive',
			h3_cells: ['8928308280fffff']
		});
		expect(row.latitude).not.toBe(0);
	});

	it('withZoneDbRow attaches dbRow projection', () => {
		const zone = { id: 'z1', name: 'Z', cells: ['8928308280fffff'], metadata: {} };
		const enriched = withZoneDbRow(zone);
		expect(enriched.dbRow.geofence_id).toBe('z1');
	});

	it('centroid handles multiple H3 cells', () => {
		const row = toGeofenceRowFromH3Zone({
			id: 'zone-2',
			name: 'Multi',
			cells: ['8928308280fffff', '8928308281fffff'],
			metadata: { device_id: 'dev-1', alertType: 'inside', status: 'active' }
		});
		expect(row.radius).toBeGreaterThan(50);
	});

	it('centroid returns origin without valid cells', () => {
		const row = toGeofenceRowFromH3Zone({
			id: 'zone-empty',
			name: 'Empty',
			cells: [],
			metadata: {}
		});
		expect(row.latitude).toBe(0);
		expect(row.radius).toBe(100);
	});
});
