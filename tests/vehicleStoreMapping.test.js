import { describe, it, expect } from 'vitest';
import { mapUnitToVehicle, mergeVehicleDetail } from '$lib/stores/vehicleStore.js';

const fromList = {
	id: 'u1',
	name: 'KIA',
	device_id: '864537040123456',
	brand: 'KIA',
	model: 'Hatchback K3',
	year: 2021,
	plate: 'UMX-123',
	color: 'blue',
	icon_type: 'car'
};

describe('mapUnitToVehicle', () => {
	it('toma el perfil del listado GET /units', () => {
		const v = mapUnitToVehicle(fromList);
		expect(v).toMatchObject({
			brand: 'KIA',
			model: 'Hatchback K3',
			plate: 'UMX-123',
			iconType: 'car'
		});
	});

	it('omite los campos del perfil si la respuesta no los trae (GET /units/{id})', () => {
		const v = mapUnitToVehicle({ id: 'u1', name: 'KIA' });
		expect('brand' in v).toBe(false);
		expect('plate' in v).toBe(false);
		expect('color' in v).toBe(false);
	});

	it('conserva un null explícito: el perfil puede estar vacío', () => {
		expect(mapUnitToVehicle({ id: 'u1', plate: null }).plate).toBeNull();
	});
});

describe('mergeVehicleDetail', () => {
	it('abrir el detalle no borra la marca, el modelo ni la placa del listado', () => {
		const existing = mapUnitToVehicle(fromList);
		const merged = mergeVehicleDetail(existing, mapUnitToVehicle({ id: 'u1', name: 'KIA 2' }));
		expect(merged).toMatchObject({
			name: 'KIA 2',
			brand: 'KIA',
			model: 'Hatchback K3',
			plate: 'UMX-123',
			iconType: 'car',
			deviceId: '864537040123456'
		});
	});
});
