/**
 * El día de la flota: kilómetros por hora, utilización y actividad por unidad.
 *
 * Hoy se arma en el cliente con endpoints que ya existen, pensando en pocas
 * peticiones aunque la flota crezca:
 *
 *   - `POST /telemetry/query` en lotes de 50 dispositivos (el máximo de
 *     admin-api): kilómetros y minutos en movimiento/en reposo por hora.
 *   - `GET /trips` sin `unit_id`, paginado: todos los trayectos visibles del día.
 *   - Las alarmas del día ya están en `alarmEvents` (las carga el dashboard).
 *
 * Con N unidades son ⌈N/50⌉ + ⌈trayectos/500⌉ peticiones por refresco.
 *
 * El endpoint agregado `GET /fleet/day-summary` está planeado y todavía no existe
 * en el backend (ver docs/architecture/resumen-del-dia-de-flota.md). El cliente
 * ya sabe pedirlo cuando `VITE_FLEET_DAY_SUMMARY=true`; si el backend responde
 * 404 o 501, la UI muestra «en construcción» en lugar de un error.
 */
import { apiService, ApiError } from '$lib/services/api.js';

/** Máximo de dispositivos por `POST /telemetry/query` (MAX_BATCH_DEVICES de admin-api). */
export const TELEMETRY_BATCH_SIZE = 50;
/** Máximo de `limit` que acepta `GET /trips`. */
export const TRIPS_PAGE_LIMIT = 500;
/** Tope de páginas de trayectos por refresco: 5 000 trayectos en un día. */
export const TRIPS_MAX_PAGES = 10;
export const FLEET_DAY_METRICS = ['odometer', 'moving_minutes', 'idle_minutes'];

const HOUR_MS = 3_600_000;

/** Error que distingue «el backend aún no tiene este endpoint» de un fallo real. */
export class EnConstruccionError extends Error {
	constructor(message = 'Endpoint en construcción') {
		super(message);
		this.name = 'EnConstruccionError';
	}
}

/** @param {Record<string, unknown>} [env] */
export function isFleetDaySummaryEndpointEnabled(env = import.meta.env) {
	return String(env?.VITE_FLEET_DAY_SUMMARY ?? '').toLowerCase() === 'true';
}

/** Medianoche local de `now` y el propio `now`. @param {Date} [now] */
export function todayRange(now = new Date()) {
	const from = new Date(now);
	from.setHours(0, 0, 0, 0);
	return { from, to: new Date(now) };
}

/** Horas (fraccionarias) desde la medianoche local de `dayStart`. */
export function hoursSince(/** @type {Date} */ dayStart, /** @type {string|Date} */ value) {
	const t = value instanceof Date ? value.getTime() : new Date(String(value)).getTime();
	if (Number.isNaN(t)) return null;
	return (t - dayStart.getTime()) / HOUR_MS;
}

/**
 * @template T
 * @param {T[]} list
 * @param {number} size
 * @returns {T[][]}
 */
export function chunk(list, size) {
	const out = [];
	for (let i = 0; i < list.length; i += size) out.push(list.slice(i, i + size));
	return out;
}

/**
 * Pide la telemetría horaria del rango en lotes y devuelve la lista plana de
 * dispositivos tal como la responde admin-api.
 * @param {string[]} refs
 * @param {{ from: Date, to: Date }} range
 * @param {{ queryTelemetry: (body: Record<string, unknown>) => Promise<any> }} [api]
 */
export async function fetchFleetTelemetry(refs, range, api = apiService) {
	const unique = [...new Set(refs.filter(Boolean))];
	if (unique.length === 0) return [];
	const batches = chunk(unique, TELEMETRY_BATCH_SIZE);
	const responses = await Promise.all(
		batches.map((device_ids) =>
			api.queryTelemetry({
				device_ids,
				from: range.from.toISOString(),
				to: range.to.toISOString(),
				granularity: 'hour',
				metrics: FLEET_DAY_METRICS
			})
		)
	);
	return responses.flatMap((r) => (Array.isArray(r?.devices) ? r.devices : []));
}

/**
 * Suma la telemetría de la flota por hora local.
 * @param {Array<{ device_id: string, series?: any[] }>} devices
 * @param {Map<string, string>} refToUnit referencia del dispositivo → id de unidad
 * @param {Date} now
 */
export function aggregateTelemetry(devices, refToUnit, now) {
	const dayStart = todayRange(now).from;
	const currentHour = Math.floor(hoursSince(dayStart, now) ?? 0);
	/** @type {(number|null)[]} */
	const kmByHour = Array.from({ length: 24 }, (_, h) => (h <= currentHour ? 0 : null));
	const moving = Array(24).fill(0);
	const idle = Array(24).fill(0);
	/** @type {Record<string, number>} */
	const kmByUnit = {};
	let hasDistance = false;
	let hasTime = false;

	for (const device of devices || []) {
		const unitId = refToUnit.get(String(device?.device_id ?? '')) ?? null;
		for (const bucket of device?.series || []) {
			const h = Math.floor(hoursSince(dayStart, bucket?.bucket) ?? -1);
			if (h < 0 || h > 23) continue;
			const metres = bucket?.odometer?.total_distance_mt;
			if (metres != null && Number.isFinite(Number(metres))) {
				const km = Number(metres) / 1000;
				kmByHour[h] = (kmByHour[h] ?? 0) + km;
				if (unitId) kmByUnit[unitId] = (kmByUnit[unitId] ?? 0) + km;
				hasDistance = true;
			}
			if (bucket?.moving_minutes != null) {
				moving[h] += Number(bucket.moving_minutes) || 0;
				hasTime = true;
			}
			if (bucket?.idle_minutes != null) {
				idle[h] += Number(bucket.idle_minutes) || 0;
				hasTime = true;
			}
		}
	}

	const utilizationByHour = moving.map((m, h) => {
		if (h > currentHour) return null;
		const total = m + idle[h];
		return total > 0 ? (m / total) * 100 : null;
	});
	const movingMinutes = moving.reduce((a, b) => a + b, 0);
	const idleMinutes = idle.reduce((a, b) => a + b, 0);
	const serviceMinutes = movingMinutes + idleMinutes;

	return {
		kmByHour,
		kmTotal: hasDistance ? kmByHour.reduce((a, b) => a + (b ?? 0), 0) : null,
		kmByUnit,
		currentHour,
		movingMinutes,
		idleMinutes,
		utilization: hasTime && serviceMinutes > 0 ? (movingMinutes / serviceMinutes) * 100 : null,
		utilizationByHour
	};
}

/**
 * Todos los trayectos del día que el usuario puede ver, siguiendo el cursor.
 * @param {{ from: Date, to: Date }} range
 * @param {{ getTrips: (params: Record<string, unknown>) => Promise<any> }} [api]
 */
export async function fetchTodayTrips(range, api = apiService) {
	/** @type {any[]} */
	const trips = [];
	let cursor = null;
	let truncated = false;
	for (let page = 0; page < TRIPS_MAX_PAGES; page++) {
		const res = await api.getTrips({
			start_date: range.from.toISOString(),
			end_date: range.to.toISOString(),
			limit: TRIPS_PAGE_LIMIT,
			...(cursor ? { cursor } : {})
		});
		trips.push(...(Array.isArray(res?.trips) ? res.trips : []));
		if (!res?.has_more || !res?.cursor) return { trips, truncated };
		cursor = res.cursor;
		truncated = page === TRIPS_MAX_PAGES - 1;
	}
	return { trips, truncated };
}

/**
 * Una fila por unidad: tramos en ruta (de los trayectos) y marcas de alarma.
 * Los trayectos traen `device_id`; se cruzan con `unit.deviceId`.
 * @param {Array<{ id: string, name?: string, deviceId?: string|null, deviceRef?: string|null }>} units
 * @param {any[]} trips
 * @param {Array<{ unitId?: string|null, type?: string, name?: string, at: string }>} alarms
 * @param {Date} now
 */
export function buildActivity(units, trips, alarms, now) {
	const dayStart = todayRange(now).from;
	const nowH = hoursSince(dayStart, now) ?? 0;
	/** @type {Map<string, string>} */
	const deviceToUnit = new Map();
	for (const u of units) {
		if (u.deviceId) deviceToUnit.set(String(u.deviceId), u.id);
		if (u.deviceRef) deviceToUnit.set(String(u.deviceRef), u.id);
	}
	/** @type {Map<string, { unitId: string, name: string, segments: any[], marks: any[], movingHours: number }>} */
	const rows = new Map(
		units.map((u) => [
			u.id,
			{ unitId: u.id, name: u.name || 'Unidad', segments: [], marks: [], movingHours: 0 }
		])
	);

	for (const trip of trips || []) {
		const unitId = deviceToUnit.get(String(trip?.device_id ?? ''));
		const row = unitId ? rows.get(unitId) : null;
		if (!row) continue;
		const start = Math.max(0, hoursSince(dayStart, trip.start_timestamp) ?? -1);
		const ongoing = !trip.end_timestamp;
		const end = ongoing ? nowH : Math.min(nowH, hoursSince(dayStart, trip.end_timestamp) ?? nowH);
		if (end <= start) continue;
		row.segments.push({ start, end, ongoing, km: trip.distance_km ?? null });
		row.movingHours += end - start;
	}

	for (const alarm of alarms || []) {
		const row = alarm?.unitId ? rows.get(String(alarm.unitId)) : null;
		const at = row ? hoursSince(dayStart, alarm.at) : null;
		if (!row || at == null || at < 0 || at > 24) continue;
		row.marks.push({
			at,
			type: alarm.type === 'ignition' ? 'ignition' : 'zone',
			label: alarm.name
		});
	}

	const list = [...rows.values()];
	for (const r of list) {
		r.segments.sort((a, b) => a.start - b.start);
		r.marks.sort((a, b) => a.at - b.at);
	}
	// Primero quien más se movió; las unidades sin actividad al final, por nombre.
	list.sort((a, b) => b.movingHours - a.movingHours || a.name.localeCompare(b.name, 'es'));
	return { rows: list, nowHour: nowH };
}

/**
 * Endpoint agregado planeado. Devuelve el resumen o lanza EnConstruccionError
 * mientras el backend no lo tenga.
 * @param {{ from: Date, to: Date }} range
 * @param {{ getFleetDaySummary: (params: Record<string, unknown>) => Promise<any> }} [api]
 */
export async function fetchFleetDaySummary(range, api = apiService) {
	try {
		return await api.getFleetDaySummary({
			from: range.from.toISOString(),
			to: range.to.toISOString(),
			tz: Intl.DateTimeFormat().resolvedOptions().timeZone
		});
	} catch (err) {
		if (err instanceof ApiError && (err.status === 404 || err.status === 501)) {
			throw new EnConstruccionError();
		}
		throw err;
	}
}

/**
 * Arma el día completo con los endpoints existentes.
 * @param {{
 *   units: Array<{ id: string, name?: string, deviceId?: string|null, deviceRef?: string|null }>,
 *   alarms: any[],
 *   now?: Date,
 *   api?: any
 * }} input
 */
export async function loadFleetDay({ units, alarms, now = new Date(), api = apiService }) {
	const range = todayRange(now);
	/** @type {Map<string, string>} */
	const refToUnit = new Map();
	for (const u of units) {
		const ref = u.deviceRef || u.deviceId;
		if (ref) refToUnit.set(String(ref), u.id);
	}
	const [devices, tripsResult] = await Promise.all([
		fetchFleetTelemetry([...refToUnit.keys()], range, api),
		fetchTodayTrips(range, api)
	]);
	return {
		telemetry: aggregateTelemetry(devices, refToUnit, now),
		activity: buildActivity(units, tripsResult.trips, alarms, now),
		tripsTruncated: tripsResult.truncated,
		updatedAt: now.toISOString()
	};
}

/**
 * Ventana de horas que muestran las gráficas: de 06:00 a 22:00 como mínimo,
 * ampliada si hubo actividad antes de las 6 o si ya es más tarde de las 22.
 * Devuelve `[inicio, fin)` en horas enteras.
 * @param {(number|null)[]} values valores por hora (null = futuro)
 * @param {number} currentHour
 */
export function hourWindow(values, currentHour) {
	const firstActive = (values || []).findIndex((v) => v != null && v > 0);
	const start = firstActive >= 0 ? Math.min(6, firstActive) : 6;
	const end = Math.max(22, Math.min(24, currentHour + 1));
	return [start, end];
}

/** Máximo «redondo» (1, 2, 2.5 o 5 × 10ⁿ) para la escala de una gráfica. */
export function niceMax(/** @type {number} */ value) {
	if (!Number.isFinite(value) || value <= 0) return 1;
	const exp = 10 ** Math.floor(Math.log10(value));
	const f = value / exp;
	const step = f <= 1 ? 1 : f <= 2 ? 2 : f <= 2.5 ? 2.5 : f <= 5 ? 5 : 10;
	return step * exp;
}
