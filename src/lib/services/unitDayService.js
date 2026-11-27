/**
 * El día de una sola unidad (vista Panel, «modo unidad»): kilómetros con
 * comparación contra ayer, batería de las últimas 24 h, combustible de los
 * últimos 7 días y la línea de tiempo del día (en ruta, ralentí, apagado,
 * velocidad, encendidos/apagados).
 *
 * Tres peticiones por refresco, todas de una sola unidad:
 * - `POST /telemetry/query` por hora de los últimos 7 días (el máximo que
 *   admin-api permite con granularidad horaria);
 * - `GET /units/{id}/trips` de hoy;
 * - `GET /api/v1/events` de hoy (siscom-api) para encendidos y apagados.
 */
import { apiService } from '$lib/services/api.js';
import { eventService } from '$lib/services/eventService.js';
import { todayRange, hoursSince, fetchIgnitionEvents } from '$lib/services/fleetDayService.js';

export const UNIT_DAY_METRICS = [
	'speed',
	'main_battery',
	'odometer',
	'moving_minutes',
	'idle_minutes',
	'fuel_consumed_liters'
];
/** Días de historia (hoy incluido). Con granularidad horaria admin-api acepta 7. */
export const UNIT_HISTORY_DAYS = 7;
/** Umbrales de batería principal (12 V), los mismos que las fichas de telemetría. */
export const BATTERY_OK_V = 12.2;
export const BATTERY_LOW_V = 11.5;

const HOUR_MS = 3_600_000;

/** Desde la medianoche local de hace 6 días hasta ahora. */
export function weekRange(now = new Date()) {
	const from = new Date(now);
	from.setHours(0, 0, 0, 0);
	from.setDate(from.getDate() - (UNIT_HISTORY_DAYS - 1));
	return { from, to: new Date(now) };
}

/** Clave local AAAA-MM-DD. */
function dayKey(/** @type {Date} */ d) {
	return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

const num = (/** @type {any} */ v) => (v == null || !Number.isFinite(Number(v)) ? null : Number(v));

/**
 * Intervalos con el motor encendido a partir de los eventos del día. Si el
 * primer evento es un apagado, se asume encendido desde la medianoche; si el
 * último es un encendido, sigue encendido hasta ahora.
 * @param {Array<{ type: string, at: string }>} events
 * @param {Date} dayStart
 * @param {number} nowH
 * @returns {Array<{ start: number, end: number }>}
 */
export function ignitionIntervals(events, dayStart, nowH) {
	const sorted = [...(events || [])]
		.map((e) => ({ on: e.type === 'ignition_on', at: hoursSince(dayStart, e.at) }))
		.filter((e) => e.at != null)
		.sort((a, b) => /** @type {number} */ (a.at) - /** @type {number} */ (b.at));
	/** @type {Array<{ start: number, end: number }>} */
	const out = [];
	let openAt = sorted.length && !sorted[0].on ? 0 : null;
	for (const e of sorted) {
		const at = Math.max(0, Math.min(nowH, /** @type {number} */ (e.at)));
		if (e.on) {
			if (openAt == null) openAt = at;
		} else if (openAt != null) {
			if (at > openAt) out.push({ start: openAt, end: at });
			openAt = null;
		}
	}
	if (openAt != null && nowH > openAt) out.push({ start: openAt, end: nowH });
	return out;
}

/**
 * Resta los tramos en ruta de los intervalos encendidos: lo que queda es
 * ralentí (motor encendido sin moverse).
 * @param {Array<{ start: number, end: number }>} on
 * @param {Array<{ start: number, end: number }>} moving
 */
export function subtractIntervals(on, moving) {
	/** @type {Array<{ start: number, end: number }>} */
	let out = on.map((i) => ({ ...i }));
	for (const m of moving) {
		out = out.flatMap((i) => {
			if (m.end <= i.start || m.start >= i.end) return [i];
			const parts = [];
			if (m.start > i.start) parts.push({ start: i.start, end: m.start });
			if (m.end < i.end) parts.push({ start: m.end, end: i.end });
			return parts;
		});
	}
	// Tramos de menos de un minuto son ruido del redondeo de horas.
	return out.filter((i) => i.end - i.start >= 1 / 60);
}

/**
 * Convierte las series y los trayectos en lo que pintan las tarjetas.
 * @param {{
 *   series: any[],
 *   trips: any[],
 *   ignition: Array<{ type: string, at: string }> | null,
 *   now: Date
 * }} input
 */
export function summarizeUnitDay({ series, trips, ignition, now }) {
	const dayStart = todayRange(now).from;
	const nowH = hoursSince(dayStart, now) ?? 0;
	const currentHour = Math.floor(nowH);
	const yesterdayStart = new Date(dayStart);
	yesterdayStart.setDate(yesterdayStart.getDate() - 1);

	// Hoy, por hora.
	const hours = Array.from({ length: 24 }, (_, h) =>
		h <= currentHour ? { km: 0, moving: 0, idle: 0, maxSpeed: null, avgSpeed: null } : null
	);
	let kmToday = 0;
	let kmYesterdaySameTime = 0;
	let hasYesterday = false;
	let movingMinutes = 0;
	let idleMinutes = 0;
	/** @type {number|null} */
	let maxSpeed = null;

	// Últimos 7 días (hoy al final).
	/** @type {Map<string, { date: Date, km: number, liters: number, hasFuel: boolean }>} */
	const days = new Map();
	for (let i = UNIT_HISTORY_DAYS - 1; i >= 0; i--) {
		const d = new Date(dayStart);
		d.setDate(d.getDate() - i);
		days.set(dayKey(d), { date: d, km: 0, liters: 0, hasFuel: false });
	}

	// Batería de las últimas 24 h (por hora, de la más vieja a la actual).
	const since24 = now.getTime() - 24 * HOUR_MS;
	/** @type {Array<{ at: Date, hoursAgo: number, min: number|null, avg: number|null, engineOff: boolean }>} */
	const battery = [];

	for (const b of series || []) {
		const at = new Date(String(b?.bucket));
		if (Number.isNaN(at.getTime())) continue;
		const km = (num(b?.odometer?.total_distance_mt) ?? 0) / 1000;
		const liters = num(b?.fuel_consumed_liters);
		const moving = num(b?.moving_minutes) ?? 0;
		const idle = num(b?.idle_minutes) ?? 0;

		const day = days.get(dayKey(at));
		if (day) {
			day.km += km;
			if (liters != null) {
				day.liters += liters;
				day.hasFuel = true;
			}
		}

		const h = hoursSince(dayStart, at);
		if (h != null && h >= 0 && h < 24 && hours[Math.floor(h)]) {
			const slot = /** @type {any} */ (hours[Math.floor(h)]);
			slot.km += km;
			slot.moving += moving;
			slot.idle += idle;
			const mx = num(b?.speed?.max_speed);
			const av = num(b?.speed?.avg_speed);
			if (mx != null) slot.maxSpeed = Math.max(slot.maxSpeed ?? 0, mx);
			if (av != null) slot.avgSpeed = av;
			kmToday += km;
			movingMinutes += moving;
			idleMinutes += idle;
			if (mx != null) maxSpeed = Math.max(maxSpeed ?? 0, mx);
		}

		const hy = hoursSince(yesterdayStart, at);
		if (hy != null && hy >= 0 && hy < 24) {
			hasYesterday = true;
			if (hy < nowH) kmYesterdaySameTime += km;
		}

		if (at.getTime() >= since24 - HOUR_MS) {
			battery.push({
				at,
				hoursAgo: (now.getTime() - at.getTime()) / HOUR_MS,
				min: num(b?.main_battery?.min_voltage),
				avg: num(b?.main_battery?.avg_voltage),
				engineOff: moving === 0 && idle === 0
			});
		}
	}
	battery.sort((a, b) => a.at.getTime() - b.at.getTime());

	const dayList = [...days.values()].map((d) => ({
		date: d.date,
		label: d.date.toLocaleDateString('es-MX', { weekday: 'short' }).replace('.', ''),
		km: d.km,
		liters: d.hasFuel ? d.liters : null,
		per100: d.hasFuel && d.km >= 1 ? (d.liters / d.km) * 100 : null
	}));
	const fuelDays = dayList.filter((d) => d.liters != null);
	const weekKm = fuelDays.reduce((a, d) => a + d.km, 0);
	const weekLiters = fuelDays.reduce((a, d) => a + (d.liters ?? 0), 0);

	// Línea de tiempo.
	const segments = (trips || [])
		.map((t) => {
			const start = Math.max(0, hoursSince(dayStart, t.start_timestamp) ?? -1);
			const ongoing = !t.end_timestamp;
			const end = ongoing ? nowH : Math.min(nowH, hoursSince(dayStart, t.end_timestamp) ?? nowH);
			return { tripId: t.trip_id ?? null, start, end, ongoing, km: num(t.distance_km) };
		})
		.filter((s) => s.end > s.start)
		.sort((a, b) => a.start - b.start);

	const ignitionKnown = Array.isArray(ignition);
	const marks = (ignition || [])
		.map((e) => ({ at: hoursSince(dayStart, e.at), type: e.type }))
		.filter((m) => m.at != null && m.at >= 0 && m.at <= 24);
	/** @type {Array<{ start: number, end: number, approx?: boolean }>} */
	let idle = [];
	if (ignitionKnown && ignition.length > 0) {
		idle = subtractIntervals(ignitionIntervals(ignition, dayStart, nowH), segments);
	} else {
		// Sin eventos: el ralentí por hora, como bloque al inicio de esa hora (aproximado).
		hours.forEach((slot, h) => {
			if (slot && slot.idle >= 1) {
				idle.push({ start: h, end: h + Math.min(1, slot.idle / 60), approx: true });
			}
		});
	}

	const kmTrend =
		hasYesterday && kmYesterdaySameTime >= 0.1
			? ((kmToday - kmYesterdaySameTime) / kmYesterdaySameTime) * 100
			: null;

	const lastBattery = [...battery].reverse().find((b) => b.avg != null || b.min != null) ?? null;

	return {
		nowHour: nowH,
		currentHour,
		hours,
		kmToday,
		kmYesterdaySameTime: hasYesterday ? kmYesterdaySameTime : null,
		kmTrend,
		movingMinutes,
		idleMinutes,
		stops: segments.filter((s) => !s.ongoing).length,
		maxSpeed,
		battery,
		batteryNow: lastBattery ? (lastBattery.avg ?? lastBattery.min) : null,
		batteryDrops: battery.filter(
			(b) => b.engineOff && b.min != null && b.min < BATTERY_OK_V && b.hoursAgo <= 24
		),
		days: dayList,
		fuelToday: dayList[dayList.length - 1]?.liters ?? null,
		fuelWeekPer100: weekKm >= 1 ? (weekLiters / weekKm) * 100 : null,
		hasFuel: fuelDays.length > 0,
		timeline: { segments, idle, marks, ignitionKnown }
	};
}

/**
 * @param {{
 *   unit: { id: string, deviceRef?: string|null, deviceId?: string|null },
 *   now?: Date,
 *   api?: { queryTelemetry: (b: any) => Promise<any>, getUnitTrips: (id: string, p: any) => Promise<any> },
 *   events?: { getEvents: (q: any) => Promise<any> }
 * }} input
 */
export async function loadUnitDay({
	unit,
	now = new Date(),
	api = apiService,
	events = eventService
}) {
	const ref = unit?.deviceRef || unit?.deviceId;
	if (!ref) throw new Error('La unidad no tiene dispositivo asignado.');
	const week = weekRange(now);
	const today = todayRange(now);
	const [tele, tripsRes, ign] = await Promise.all([
		api.queryTelemetry({
			device_ids: [ref],
			from: week.from.toISOString(),
			to: week.to.toISOString(),
			granularity: 'hour',
			metrics: UNIT_DAY_METRICS
		}),
		api
			.getUnitTrips(unit.id, {
				start_date: today.from.toISOString(),
				end_date: today.to.toISOString(),
				limit: 100
			})
			.catch(() => ({ trips: [] })),
		fetchIgnitionEvents([unit.id], today, events)
	]);
	const device = (tele?.devices || [])[0];
	return {
		unitId: unit.id,
		...summarizeUnitDay({
			series: device?.series || [],
			trips: tripsRes?.trips || [],
			ignition: ign.failed ? null : ign.events,
			now
		}),
		updatedAt: now.toISOString()
	};
}
