import { describe, it, expect, vi } from 'vitest';
import {
	TELEMETRY_BATCH_SIZE,
	TRIPS_MAX_PAGES,
	FLEET_DAY_METRICS,
	EnConstruccionError,
	isFleetDaySummaryEndpointEnabled,
	todayRange,
	hoursSince,
	chunk,
	fetchFleetTelemetry,
	aggregateTelemetry,
	fetchTodayTrips,
	buildActivity,
	fetchFleetDaySummary,
	loadFleetDay,
	hourWindow,
	niceMax,
	fetchIgnitionEvents,
	formatHour,
	EVENTS_BATCH_SIZE
} from '$lib/services/fleetDayService.js';
import { ApiError } from '$lib/services/apiErrors.js';

// Jueves 26/11/2026, 14:20 hora local.
const NOW = new Date(2026, 10, 26, 14, 20);
const at = (h, m = 0) => new Date(2026, 10, 26, h, m).toISOString();

describe('rango y utilidades', () => {
	it('todayRange va de la medianoche local a ahora', () => {
		const { from, to } = todayRange(NOW);
		expect(from.getHours()).toBe(0);
		expect(from.getMinutes()).toBe(0);
		expect(from.getDate()).toBe(26);
		expect(to.getTime()).toBe(NOW.getTime());
	});

	it('hoursSince da horas fraccionarias y null con fechas inválidas', () => {
		const { from } = todayRange(NOW);
		expect(hoursSince(from, at(6, 30))).toBeCloseTo(6.5);
		expect(hoursSince(from, new Date(2026, 10, 26, 1))).toBe(1);
		expect(hoursSince(from, 'no-es-fecha')).toBeNull();
	});

	it('chunk parte la lista en lotes del tamaño pedido', () => {
		expect(chunk([1, 2, 3, 4, 5], 2)).toEqual([[1, 2], [3, 4], [5]]);
		expect(chunk([], 3)).toEqual([]);
	});

	it('el endpoint agregado solo se usa con la variable en true', () => {
		expect(isFleetDaySummaryEndpointEnabled({ VITE_FLEET_DAY_SUMMARY: 'true' })).toBe(true);
		expect(isFleetDaySummaryEndpointEnabled({ VITE_FLEET_DAY_SUMMARY: 'TRUE' })).toBe(true);
		expect(isFleetDaySummaryEndpointEnabled({ VITE_FLEET_DAY_SUMMARY: '1' })).toBe(false);
		expect(isFleetDaySummaryEndpointEnabled({})).toBe(false);
		expect(isFleetDaySummaryEndpointEnabled(undefined)).toBe(false);
	});
});

describe('fetchFleetTelemetry', () => {
	it('agrupa en lotes del máximo de admin-api, sin repetidos ni vacíos', async () => {
		const refs = Array.from({ length: TELEMETRY_BATCH_SIZE + 3 }, (_, i) => `ref-${i}`);
		const api = {
			queryTelemetry: vi.fn(async (body) => ({
				devices: body.device_ids.map((id) => ({ device_id: id, series: [] }))
			}))
		};
		const devices = await fetchFleetTelemetry([...refs, 'ref-0', '', null], todayRange(NOW), api);
		expect(api.queryTelemetry).toHaveBeenCalledTimes(2);
		const [first, second] = api.queryTelemetry.mock.calls.map((c) => c[0]);
		expect(first.device_ids).toHaveLength(TELEMETRY_BATCH_SIZE);
		expect(second.device_ids).toHaveLength(3);
		expect(first).toMatchObject({ granularity: 'hour', metrics: FLEET_DAY_METRICS });
		expect(first.to).toBe(NOW.toISOString());
		expect(devices).toHaveLength(refs.length);
	});

	it('sin dispositivos no pide nada', async () => {
		const api = { queryTelemetry: vi.fn() };
		expect(await fetchFleetTelemetry([], todayRange(NOW), api)).toEqual([]);
		expect(api.queryTelemetry).not.toHaveBeenCalled();
	});

	it('tolera respuestas sin `devices`', async () => {
		const api = { queryTelemetry: vi.fn(async () => ({})) };
		expect(await fetchFleetTelemetry(['a'], todayRange(NOW), api)).toEqual([]);
	});
});

describe('aggregateTelemetry', () => {
	const refToUnit = new Map([
		['ref-a', 'u1'],
		['ref-b', 'u2']
	]);
	const devices = [
		{
			device_id: 'ref-a',
			series: [
				{
					bucket: at(6),
					odometer: { total_distance_mt: 12_500 },
					moving_minutes: 40,
					idle_minutes: 20
				},
				{
					bucket: at(14),
					odometer: { total_distance_mt: 3_000 },
					moving_minutes: 10,
					idle_minutes: 10
				}
			]
		},
		{
			device_id: 'ref-b',
			series: [
				{
					bucket: at(6),
					odometer: { total_distance_mt: 7_500 },
					moving_minutes: 20,
					idle_minutes: 40
				},
				{ bucket: at(13), odometer: { total_distance_mt: null } },
				{
					bucket: new Date(2026, 10, 25, 23).toISOString(),
					odometer: { total_distance_mt: 99_000 }
				}
			]
		},
		{
			device_id: 'desconocido',
			series: [{ bucket: at(9), odometer: { total_distance_mt: 1_000 } }]
		}
	];

	it('suma kilómetros por hora local y por unidad, ignorando el día anterior', () => {
		const r = aggregateTelemetry(devices, refToUnit, NOW);
		expect(r.currentHour).toBe(14);
		expect(r.kmByHour[6]).toBeCloseTo(20);
		expect(r.kmByHour[9]).toBeCloseTo(1);
		expect(r.kmByHour[14]).toBeCloseTo(3);
		expect(r.kmByHour[10]).toBe(0);
		expect(r.kmByHour[15]).toBeNull();
		expect(r.kmTotal).toBeCloseTo(24);
		expect(r.kmByUnit).toEqual({ u1: 15.5, u2: 7.5 });
	});

	it('calcula la utilización como minutos en movimiento sobre minutos en servicio', () => {
		const r = aggregateTelemetry(devices, refToUnit, NOW);
		expect(r.movingMinutes).toBe(70);
		expect(r.idleMinutes).toBe(70);
		expect(r.utilization).toBeCloseTo(50);
		expect(r.utilizationByHour[6]).toBeCloseTo(50);
		expect(r.utilizationByHour[14]).toBeCloseTo(50);
		expect(r.utilizationByHour[10]).toBeNull();
		expect(r.utilizationByHour[20]).toBeNull();
	});

	it('sin datos devuelve null en total y utilización, no cero', () => {
		const r = aggregateTelemetry([], refToUnit, NOW);
		expect(r.kmTotal).toBeNull();
		expect(r.utilization).toBeNull();
		expect(r.kmByHour.filter((v) => v === 0)).toHaveLength(15);
	});
});

describe('fetchTodayTrips', () => {
	it('sigue el cursor hasta que no hay más', async () => {
		const api = {
			getTrips: vi
				.fn()
				.mockResolvedValueOnce({ trips: [{ trip_id: 1 }], has_more: true, cursor: 'c1' })
				.mockResolvedValueOnce({ trips: [{ trip_id: 2 }], has_more: false, cursor: null })
		};
		const r = await fetchTodayTrips(todayRange(NOW), api);
		expect(r).toEqual({ trips: [{ trip_id: 1 }, { trip_id: 2 }], truncated: false });
		expect(api.getTrips.mock.calls[0][0]).not.toHaveProperty('cursor');
		expect(api.getTrips.mock.calls[1][0]).toMatchObject({ cursor: 'c1', limit: 500 });
	});

	it('se detiene en el tope de páginas y avisa que quedó truncado', async () => {
		const api = {
			getTrips: vi.fn(async () => ({ trips: [{}], has_more: true, cursor: 'x' }))
		};
		const r = await fetchTodayTrips(todayRange(NOW), api);
		expect(api.getTrips).toHaveBeenCalledTimes(TRIPS_MAX_PAGES);
		expect(r.truncated).toBe(true);
		expect(r.trips).toHaveLength(TRIPS_MAX_PAGES);
	});

	it('tolera respuestas sin lista de trayectos', async () => {
		const api = { getTrips: vi.fn(async () => null) };
		expect(await fetchTodayTrips(todayRange(NOW), api)).toEqual({ trips: [], truncated: false });
	});
});

describe('buildActivity', () => {
	const units = [
		{ id: 'u1', name: 'Reparto 04', deviceId: 'imei-1' },
		{ id: 'u2', name: 'Dirección', deviceRef: 'ref-2' },
		{ id: 'u3', name: 'Ventas 02' }
	];
	const trips = [
		{ device_id: 'imei-1', start_timestamp: at(7), end_timestamp: at(9), distance_km: 30 },
		{ device_id: 'imei-1', start_timestamp: at(13), end_timestamp: null },
		{ device_id: 'ref-2', start_timestamp: at(10), end_timestamp: at(10, 30) },
		{ device_id: 'ref-2', start_timestamp: at(11), end_timestamp: at(11) },
		{ device_id: 'otro', start_timestamp: at(8), end_timestamp: at(9) },
		{
			device_id: 'ref-2',
			start_timestamp: new Date(2026, 10, 25, 23).toISOString(),
			end_timestamp: at(1)
		}
	];
	const alarms = [
		{ unitId: 'u1', type: 'zone', name: 'Salida de zona', at: at(12) },
		{ unitId: 'u1', type: 'ignition', name: 'Ignición encendida', at: at(6, 55) },
		{ unitId: 'nadie', type: 'zone', at: at(12) },
		{ type: 'zone', at: at(12) }
	];

	it('arma tramos por unidad, con el trayecto en curso hasta ahora', () => {
		const { rows, nowHour } = buildActivity(units, trips, alarms, NOW);
		expect(nowHour).toBeCloseTo(14 + 20 / 60);
		const r1 = rows.find((r) => r.unitId === 'u1');
		expect(r1.segments).toEqual([
			{ start: 7, end: 9, ongoing: false, km: 30 },
			{ start: 13, end: nowHour, ongoing: true, km: null }
		]);
		expect(r1.marks.map((m) => m.type)).toEqual(['ignition', 'zone']);
	});

	it('recorta a la medianoche el trayecto que empezó ayer y descarta los de duración cero', () => {
		const r2 = buildActivity(units, trips, alarms, NOW).rows.find((r) => r.unitId === 'u2');
		expect(r2.segments).toEqual([
			{ start: 0, end: 1, ongoing: false, km: null },
			{ start: 10, end: 10.5, ongoing: false, km: null }
		]);
	});

	it('ordena por horas en movimiento y deja al final las unidades sin actividad', () => {
		const { rows } = buildActivity(units, trips, alarms, NOW);
		expect(rows.map((r) => r.unitId)).toEqual(['u1', 'u2', 'u3']);
		expect(rows[2].segments).toEqual([]);
	});
});

describe('fetchFleetDaySummary', () => {
	it('devuelve el resumen cuando el backend lo tiene', async () => {
		const api = { getFleetDaySummary: vi.fn(async () => ({ ok: true })) };
		expect(await fetchFleetDaySummary(todayRange(NOW), api)).toEqual({ ok: true });
		expect(api.getFleetDaySummary.mock.calls[0][0]).toHaveProperty('tz');
	});

	it.each([404, 501])('un %i se traduce a «en construcción»', async (status) => {
		const api = {
			getFleetDaySummary: vi.fn(async () => {
				throw new ApiError('no', { status });
			})
		};
		await expect(fetchFleetDaySummary(todayRange(NOW), api)).rejects.toBeInstanceOf(
			EnConstruccionError
		);
	});

	it('otros errores se propagan tal cual', async () => {
		const boom = new ApiError('caído', { status: 500 });
		const api = { getFleetDaySummary: vi.fn(async () => Promise.reject(boom)) };
		await expect(fetchFleetDaySummary(todayRange(NOW), api)).rejects.toBe(boom);
	});
});

describe('loadFleetDay', () => {
	it('pide telemetría por referencia y trayectos, y arma el día', async () => {
		const api = {
			queryTelemetry: vi.fn(async () => ({
				devices: [
					{
						device_id: 'ref-1',
						series: [
							{
								bucket: at(8),
								odometer: { total_distance_mt: 5_000 },
								moving_minutes: 30,
								idle_minutes: 30
							}
						]
					}
				]
			})),
			getTrips: vi.fn(async () => ({
				trips: [{ device_id: 'imei-1', start_timestamp: at(8), end_timestamp: at(9) }],
				has_more: false
			}))
		};
		const units = [
			{ id: 'u1', name: 'A', deviceRef: 'ref-1', deviceId: 'imei-1' },
			{ id: 'u2', name: 'B' }
		];
		const day = await loadFleetDay({ units, alarms: [], now: NOW, api });
		expect(api.queryTelemetry.mock.calls[0][0].device_ids).toEqual(['ref-1']);
		expect(day.telemetry.kmTotal).toBeCloseTo(5);
		expect(day.telemetry.kmByUnit).toEqual({ u1: 5 });
		expect(day.activity.rows[0].segments).toHaveLength(1);
		expect(day.tripsTruncated).toBe(false);
		expect(day.updatedAt).toBe(NOW.toISOString());
	});
});

describe('escala de las gráficas', () => {
	it('hourWindow muestra 06–22 por defecto y se amplía con actividad temprana o tardía', () => {
		const values = Array(24).fill(0);
		expect(hourWindow(values, 14)).toEqual([6, 22]);
		values[4] = 3;
		expect(hourWindow(values, 14)).toEqual([4, 22]);
		expect(hourWindow(values, 23)).toEqual([4, 24]);
		expect(hourWindow(null, 10)).toEqual([6, 22]);
	});

	it('niceMax redondea hacia arriba a 1, 2, 2.5, 5 o 10 por potencia de diez', () => {
		expect(niceMax(0)).toBe(1);
		expect(niceMax(Number.NaN)).toBe(1);
		expect(niceMax(0.8)).toBe(1);
		expect(niceMax(17)).toBe(20);
		expect(niceMax(23)).toBe(25);
		expect(niceMax(63.9)).toBe(100);
		expect(niceMax(410)).toBe(500);
		expect(niceMax(100)).toBe(100);
	});
});

describe('fetchIgnitionEvents', () => {
	const range = todayRange(NOW);

	it('pide por lotes de 100 unidades, pagina y se queda solo con encendidos y apagados', async () => {
		const ids = Array.from({ length: EVENTS_BATCH_SIZE + 1 }, (_, i) => `u${i}`);
		const getEvents = vi.fn(async ({ unitIds, cursor }) => {
			if (unitIds.length === 1) return { events: [], nextCursor: null };
			return cursor
				? {
						events: [{ unitId: 'u0', eventType: 'ignition_off', occurredAt: at(9) }],
						nextCursor: null
					}
				: {
						events: [
							{ unitId: 'u0', eventType: 'IGNITION_ON', occurredAt: at(8) },
							{ unitId: 'u0', eventType: 'speed_alert', occurredAt: at(8, 30) }
						],
						nextCursor: 'c1'
					};
		});
		const r = await fetchIgnitionEvents(ids, range, { getEvents });
		expect(getEvents.mock.calls.map((c) => c[0].unitIds.length)).toEqual([100, 1, 100]);
		expect(r.failed).toBe(false);
		expect(r.events).toEqual([
			{ unitId: 'u0', type: 'ignition_on', at: at(8) },
			{ unitId: 'u0', type: 'ignition_off', at: at(9) }
		]);
	});

	it('un fallo no tumba el día', async () => {
		const r = await fetchIgnitionEvents(['u1'], range, {
			getEvents: vi.fn().mockRejectedValue(new Error('x'))
		});
		expect(r).toEqual({ events: [], truncated: false, failed: true });
	});

	it('sin unidades no pide nada', async () => {
		const getEvents = vi.fn();
		expect((await fetchIgnitionEvents([], range, { getEvents })).events).toEqual([]);
		expect(getEvents).not.toHaveBeenCalled();
	});
});

describe('buildActivity con eventos de ignición', () => {
	const units = [{ id: 'u1', name: 'KIA' }];
	const alarms = [
		{ unitId: 'u1', type: 'ignition', name: 'Encendido kia', at: at(8) },
		{ unitId: 'u1', type: 'zone', name: 'Casa', at: at(10) }
	];

	it('marca encendido y apagado y descarta la alarma de ignición del cliente', () => {
		const ign = [
			{ unitId: 'u1', type: 'ignition_on', at: at(8) },
			{ unitId: 'u1', type: 'ignition_off', at: at(9, 30) }
		];
		const { rows } = buildActivity(units, [], alarms, NOW, ign);
		expect(rows[0].marks.map((m) => m.type)).toEqual(['ignition_on', 'ignition_off', 'zone']);
		expect(rows[0].marks[1].label).toBe('Apagado · 09:30');
	});

	it('sin eventos (null) usa las alarmas del cliente como antes', () => {
		const { rows } = buildActivity(units, [], alarms, NOW, null);
		expect(rows[0].marks.map((m) => m.type)).toEqual(['ignition', 'zone']);
	});
});

describe('formatHour', () => {
	it('convierte horas decimales a hh:mm', () => {
		expect(formatHour(13.5)).toBe('13:30');
		expect(formatHour(0.25)).toBe('00:15');
	});
});
