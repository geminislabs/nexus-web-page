import { describe, it, expect } from 'vitest';
import { unitHasGps, filterAndSortUnits, advancedFilterCount } from '$lib/utils/unitListFilter.js';

const units = [
	{
		id: 1,
		name: 'Reparto 04',
		brand: 'Nissan',
		plate: 'SN-73',
		status: 'active',
		speed: 74,
		engineStatus: 'ON',
		latitude: 20.5,
		longitude: -100.3,
		lastUpdate: '2026-11-26T14:00:00Z'
	},
	{
		id: 2,
		name: 'dirección',
		brand: 'KIA',
		status: 'active',
		speed: 0,
		engineStatus: 'OFF',
		latitude: 20.6,
		longitude: -100.4,
		lastUpdate: '2026-11-26T15:00:00Z'
	},
	{ id: 3, name: 'Ventas 02', status: 'inactive', speed: 0, driver: 'Ana', lastUpdate: null },
	{ id: 4, name: 'Grúa', status: 'maintenance', speed: 12, engineStatus: 'on', lat: 20, lng: -100 }
];
const ids = (list) => list.map((u) => u.id);

describe('unitHasGps', () => {
	it('acepta latitude/longitude o lat/lng', () => {
		expect(unitHasGps(units[0])).toBe(true);
		expect(unitHasGps(units[3])).toBe(true);
		expect(unitHasGps(units[2])).toBe(false);
		expect(unitHasGps({ latitude: 'x', longitude: 1 })).toBe(false);
		expect(unitHasGps(null)).toBe(false);
	});
});

describe('filterAndSortUnits', () => {
	it('sin filtros ordena por nombre en español, sin importar mayúsculas ni acentos', () => {
		expect(ids(filterAndSortUnits(units))).toEqual([2, 4, 1, 3]);
		expect(filterAndSortUnits(null)).toEqual([]);
	});

	it('busca en nombre, marca, placa y conductor', () => {
		expect(ids(filterAndSortUnits(units, { search: 'kia' }))).toEqual([2]);
		expect(ids(filterAndSortUnits(units, { search: ' sn-73 ' }))).toEqual([1]);
		expect(ids(filterAndSortUnits(units, { search: 'ana' }))).toEqual([3]);
	});

	it('filtra por estado administrativo', () => {
		expect(ids(filterAndSortUnits(units, { status: 'inactive' }))).toEqual([3]);
		expect(ids(filterAndSortUnits(units, { status: 'maintenance' }))).toEqual([4]);
	});

	it('filtra por ignición, movimiento y GPS', () => {
		expect(ids(filterAndSortUnits(units, { ignition: 'on' }))).toEqual([4, 1]);
		expect(ids(filterAndSortUnits(units, { ignition: 'off' }))).toEqual([2, 3]);
		expect(ids(filterAndSortUnits(units, { motion: 'moving' }))).toEqual([4, 1]);
		expect(ids(filterAndSortUnits(units, { motion: 'stopped' }))).toEqual([2, 3]);
		expect(ids(filterAndSortUnits(units, { gps: 'without' }))).toEqual([3]);
		expect(ids(filterAndSortUnits(units, { gps: 'with' }))).toEqual([2, 4, 1]);
	});

	it('ordena por velocidad o por última actualización', () => {
		expect(ids(filterAndSortUnits(units, { sortBy: 'speed' }))).toEqual([1, 4, 2, 3]);
		expect(ids(filterAndSortUnits(units, { sortBy: 'updated' })).slice(0, 2)).toEqual([2, 1]);
	});

	it('no modifica la lista original', () => {
		const copy = [...units];
		filterAndSortUnits(units, { sortBy: 'speed' });
		expect(units).toEqual(copy);
	});
});

describe('advancedFilterCount', () => {
	it('cuenta solo los filtros avanzados activos', () => {
		expect(advancedFilterCount()).toBe(0);
		expect(advancedFilterCount({ search: 'x', status: 'inactive' })).toBe(0);
		expect(
			advancedFilterCount({ ignition: 'on', motion: 'all', gps: 'without', sortBy: 'speed' })
		).toBe(3);
	});
});
