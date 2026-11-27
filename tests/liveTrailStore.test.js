import { describe, it, expect } from 'vitest';
import { get } from 'svelte/store';
import {
	TRAIL_MAX_POINTS,
	metersBetween,
	appendPositions,
	projectTrail,
	liveTrails,
	recordPositions
} from '$lib/stores/liveTrailStore.js';

const QRO = { lat: 20.5888, lng: -100.3899 };
const north = (m) => ({ lat: QRO.lat + m / 111_195, lng: QRO.lng });

describe('metersBetween', () => {
	it('mide unos 100 m hacia el norte', () => {
		expect(metersBetween(QRO, north(100))).toBeCloseTo(100, 0);
	});
});

describe('appendPositions', () => {
	it('agrega puntos nuevos y devuelve otro objeto', () => {
		const t0 = {};
		const t1 = appendPositions(t0, [{ id: 1, latitude: QRO.lat, longitude: QRO.lng }], 10);
		expect(t1).not.toBe(t0);
		expect(t1['1']).toEqual([{ ...QRO, t: 10 }]);
	});

	it('ignora movimientos menores al umbral y devuelve el mismo objeto', () => {
		const t1 = appendPositions({}, [{ id: 'a', lat: QRO.lat, lng: QRO.lng }], 1);
		const n = north(5);
		const t2 = appendPositions(t1, [{ id: 'a', lat: n.lat, lng: n.lng }], 2);
		expect(t2).toBe(t1);
	});

	it('ignora unidades sin id o sin coordenadas válidas', () => {
		const t0 = {};
		const vehicles = [
			{ latitude: 1, longitude: 1 },
			{ id: 'x' },
			{ id: 'y', latitude: 0, longitude: 0 },
			{ id: 'z', latitude: 'nan', longitude: 3 }
		];
		expect(appendPositions(t0, vehicles, 1)).toBe(t0);
		expect(appendPositions(t0, null, 1)).toBe(t0);
	});

	it('se queda con los últimos puntos', () => {
		let t = {};
		for (let i = 0; i < TRAIL_MAX_POINTS + 5; i++) {
			const p = north(i * 20);
			t = appendPositions(t, [{ id: 'a', lat: p.lat, lng: p.lng }], i);
		}
		expect(t.a).toHaveLength(TRAIL_MAX_POINTS);
		expect(t.a[0].t).toBe(5);
	});
});

describe('projectTrail', () => {
	it('con menos de dos puntos no dibuja nada', () => {
		expect(projectTrail([], 100, 50)).toBeNull();
		expect(projectTrail([{ ...QRO, t: 0 }], 100, 50)).toBeNull();
	});

	it('proyecta dentro del lienzo y termina en el último punto', () => {
		const pts = [
			{ ...QRO, t: 0 },
			{ ...north(200), t: 1 },
			{ lat: north(200).lat, lng: QRO.lng + 0.002, t: 2 }
		];
		const r = projectTrail(pts, 140, 64, 8);
		expect(r.d.startsWith('M')).toBe(true);
		expect(r.d.split('L')).toHaveLength(3);
		const [x, y] = r.end;
		expect(x).toBeGreaterThanOrEqual(8);
		expect(x).toBeLessThanOrEqual(132);
		expect(y).toBeGreaterThanOrEqual(8);
		expect(y).toBeLessThanOrEqual(56);
	});

	it('un recorrido sin extensión no divide entre cero', () => {
		const r = projectTrail(
			[
				{ ...QRO, t: 0 },
				{ ...QRO, t: 1 }
			],
			100,
			50
		);
		expect(r.d).not.toContain('NaN');
	});
});

describe('recordPositions', () => {
	it('actualiza el store compartido', () => {
		recordPositions([{ id: 'q', latitude: QRO.lat, longitude: QRO.lng }], 7);
		expect(get(liveTrails).q).toEqual([{ ...QRO, t: 7 }]);
	});
});
