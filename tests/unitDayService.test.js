import { describe, it, expect, vi } from 'vitest';
import {
	weekRange,
	ignitionIntervals,
	subtractIntervals,
	summarizeUnitDay,
	loadUnitDay,
	UNIT_DAY_METRICS,
	UNIT_HISTORY_DAYS
} from '$lib/services/unitDayService.js';

// Viernes 27/11/2026, 14:00 hora local.
const NOW = new Date(2026, 10, 27, 14, 0);
const DAY = new Date(2026, 10, 27);
const at = (d, h, m = 0) => new Date(2026, 10, d, h, m).toISOString();

describe('weekRange', () => {
	it('va de la medianoche de hace 6 días a ahora', () => {
		const r = weekRange(NOW);
		expect(r.from).toEqual(new Date(2026, 10, 21, 0, 0));
		expect(r.to).toEqual(NOW);
		expect(UNIT_HISTORY_DAYS).toBe(7);
	});
});

describe('ignitionIntervals', () => {
	it('empareja encendidos y apagados y cierra el último en «ahora»', () => {
		const ev = [
			{ type: 'ignition_on', at: at(27, 8) },
			{ type: 'ignition_off', at: at(27, 9, 30) },
			{ type: 'ignition_on', at: at(27, 13) }
		];
		expect(ignitionIntervals(ev, DAY, 14)).toEqual([
			{ start: 8, end: 9.5 },
			{ start: 13, end: 14 }
		]);
	});

	it('si el primero es un apagado, venía encendido desde la medianoche', () => {
		expect(ignitionIntervals([{ type: 'ignition_off', at: at(27, 1) }], DAY, 14)).toEqual([
			{ start: 0, end: 1 }
		]);
	});
});

describe('subtractIntervals', () => {
	it('deja el ralentí: encendido menos en ruta', () => {
		expect(subtractIntervals([{ start: 8, end: 10 }], [{ start: 8.5, end: 9.5 }])).toEqual([
			{ start: 8, end: 8.5 },
			{ start: 9.5, end: 10 }
		]);
	});
});

describe('summarizeUnitDay', () => {
	const bucket = (d, h, extra = {}) => ({ bucket: at(d, h), ...extra });
	const series = [
		bucket(26, 9, {
			odometer: { total_distance_mt: 10000 },
			fuel_consumed_liters: 1
		}),
		bucket(26, 20, { odometer: { total_distance_mt: 5000 }, fuel_consumed_liters: 0.5 }),
		bucket(27, 3, {
			main_battery: { min_voltage: 11.9, avg_voltage: 12.0 },
			moving_minutes: 0,
			idle_minutes: 0
		}),
		bucket(27, 9, {
			odometer: { total_distance_mt: 12000 },
			fuel_consumed_liters: 1.2,
			moving_minutes: 30,
			idle_minutes: 10,
			speed: { max_speed: 80, avg_speed: 40 },
			main_battery: { min_voltage: 13.8, avg_voltage: 14.0 }
		})
	];

	const r = summarizeUnitDay({
		series,
		trips: [
			{
				trip_id: 't1',
				start_timestamp: at(27, 9),
				end_timestamp: at(27, 9, 30),
				distance_km: 12
			}
		],
		ignition: [
			{ type: 'ignition_on', at: at(27, 8, 50) },
			{ type: 'ignition_off', at: at(27, 9, 40) }
		],
		now: NOW
	});

	it('kilómetros de hoy y comparación con ayer a la misma hora', () => {
		expect(r.kmToday).toBe(12);
		// Ayer hasta las 14:00 solo cuentan los 10 km de las 9:00 (no los de las 20:00).
		expect(r.kmYesterdaySameTime).toBe(10);
		expect(r.kmTrend).toBeCloseTo(20);
	});

	it('números del día', () => {
		expect(r.movingMinutes).toBe(30);
		expect(r.idleMinutes).toBe(10);
		expect(r.maxSpeed).toBe(80);
		expect(r.stops).toBe(1);
	});

	it('combustible por día y L/100 km de la semana', () => {
		expect(r.days).toHaveLength(7);
		expect(r.fuelToday).toBeCloseTo(1.2);
		expect(r.days[5].liters).toBeCloseTo(1.5);
		// 2.7 L / 27 km = 10 L/100 km
		expect(r.fuelWeekPer100).toBeCloseTo(10);
		expect(r.hasFuel).toBe(true);
	});

	it('batería: valor actual y caídas con el motor apagado', () => {
		expect(r.batteryNow).toBe(14);
		expect(r.batteryDrops.map((b) => b.min)).toEqual([11.9]);
	});

	it('línea de tiempo: tramo en ruta y ralentí alrededor', () => {
		expect(r.timeline.segments[0]).toMatchObject({ tripId: 't1', start: 9, end: 9.5 });
		const idle = r.timeline.idle.map((i) => [
			Math.round(i.start * 60) / 60,
			Math.round(i.end * 60) / 60
		]);
		expect(idle).toEqual([
			[8 + 50 / 60, 9],
			[9.5, 9 + 40 / 60]
		]);
		expect(r.timeline.marks.map((m) => m.type)).toEqual(['ignition_on', 'ignition_off']);
	});

	it('sin eventos, el ralentí sale aproximado de los minutos por hora', () => {
		const s = summarizeUnitDay({ series, trips: [], ignition: null, now: NOW });
		expect(s.timeline.ignitionKnown).toBe(false);
		expect(s.timeline.idle).toEqual([{ start: 9, end: 9 + 10 / 60, approx: true }]);
	});

	it('sin combustible no inventa ceros', () => {
		const s = summarizeUnitDay({
			series: [bucket(27, 9, { odometer: { total_distance_mt: 1000 } })],
			trips: [],
			ignition: [],
			now: NOW
		});
		expect(s.hasFuel).toBe(false);
		expect(s.fuelToday).toBeNull();
	});
});

describe('loadUnitDay', () => {
	it('hace una consulta de telemetría de 7 días, una de trayectos y una de eventos', async () => {
		const api = {
			queryTelemetry: vi.fn().mockResolvedValue({ devices: [{ device_id: 'ref', series: [] }] }),
			getUnitTrips: vi.fn().mockResolvedValue({ trips: [] })
		};
		const events = { getEvents: vi.fn().mockResolvedValue({ events: [], nextCursor: null }) };
		const r = await loadUnitDay({ unit: { id: 'u1', deviceRef: 'ref' }, now: NOW, api, events });
		expect(api.queryTelemetry).toHaveBeenCalledWith(
			expect.objectContaining({
				device_ids: ['ref'],
				granularity: 'hour',
				metrics: UNIT_DAY_METRICS
			})
		);
		expect(api.getUnitTrips).toHaveBeenCalledWith('u1', expect.objectContaining({ limit: 100 }));
		expect(events.getEvents).toHaveBeenCalledTimes(1);
		expect(r.unitId).toBe('u1');
	});

	it('sin dispositivo asignado falla con un mensaje claro', async () => {
		await expect(loadUnitDay({ unit: { id: 'u1' }, now: NOW })).rejects.toThrow(
			/no tiene dispositivo/
		);
	});
});
