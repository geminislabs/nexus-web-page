export const REPORT_UNIT_COLORS = ['#22d3ee', '#34d399', '#a78bfa'];

export const TELEMETRY_METRICS = [
	'speed',
	'alerts',
	'main_battery',
	'backup_battery',
	'samples',
	'signal',
	'odometer',
	'satellites',
	'comm_quality',
	'fuel_consumed_liters',
	'moving_minutes',
	'idle_minutes'
];

/**
 * Clasifica la intensidad de señal (rxLvl) en 3 niveles pedidos por producto:
 * Malo (rojo), Regular (amarillo) y Bueno (verde). Nada de naranjas ni matices.
 * @param {number|string|null|undefined} rxLvl
 * @returns {{ grade: 'bad'|'regular'|'good', label: string, hex: string } | null}
 */
export function getSignalQuality(rxLvl) {
	const rx = Number(rxLvl);
	if (rxLvl == null || Number.isNaN(rx)) return null;
	if (rx <= 25) return { grade: 'bad', label: 'Malo', hex: '#ef4444' };
	if (rx <= 45) return { grade: 'regular', label: 'Regular', hex: '#eab308' };
	return { grade: 'good', label: 'Bueno', hex: '#22c55e' };
}

/** Clases Tailwind del chip de señal por nivel (solo rojo/amarillo/verde) */
export const SIGNAL_CHIP_CLASSES = {
	bad: 'border-red-400/50 bg-red-100 text-red-600 dark:border-red-500/30 dark:bg-red-500/15 dark:text-red-400',
	regular:
		'border-yellow-400/60 bg-yellow-100 text-yellow-700 dark:border-yellow-500/30 dark:bg-yellow-500/15 dark:text-yellow-400',
	good: 'border-green-400/50 bg-green-100 text-green-700 dark:border-green-500/30 dark:bg-green-500/15 dark:text-green-400'
};

/** @param {string} unitId @param {number} index */
export function getUnitChartColor(unitId, index = 0) {
	return REPORT_UNIT_COLORS[index % REPORT_UNIT_COLORS.length];
}

/** @param {string} iso */
export function formatBucketLabel(iso) {
	if (!iso) return '';
	const d = new Date(iso);
	if (Number.isNaN(d.getTime())) return iso;
	return d.toLocaleString('es-MX', { month: 'short', day: 'numeric', hour: '2-digit' });
}

/** @param {string} iso */
export function formatBucketDateShort(iso) {
	const d = new Date(iso);
	if (Number.isNaN(d.getTime())) return iso;
	return d.toLocaleString('es-MX', {
		month: 'short',
		day: 'numeric',
		hour: '2-digit',
		minute: '2-digit'
	});
}

/** @param {number} minutes */
export function formatMinutes(minutes) {
	if (minutes == null || Number.isNaN(minutes)) return '0 min';
	const m = Math.round(minutes);
	if (m < 60) return `${m} min`;
	const h = Math.floor(m / 60);
	const r = m % 60;
	return r > 0 ? `${h}h ${r}m` : `${h}h`;
}

/**
 * @param {Record<string, import('$lib/stores/telemetryStore.js').TelemetryEntry>} telemetryData
 * @param {Array<{ id: string, name: string }>} unitsMeta
 */
export function processTelemetryResults(telemetryData, unitsMeta) {
	let totalDistance = 0;
	let totalAlerts = 0;
	let totalFixableComms = 0;
	let totalWithFixComms = 0;
	let totalFuel = 0;
	let totalMoving = 0;
	let totalIdle = 0;
	/** @type {Array<{ id: string, type: string, value: string, date: string, unitName: string }>} */
	const offenders = [];

	// Itera en el orden de selección (unitsMeta) para que las excepciones salgan
	// en un orden estable e igual al de las apps móviles, no según qué request terminó primero.
	const orderedEntries = unitsMeta.length
		? unitsMeta
				.map((u) => /** @type {const} */ ([u.id, telemetryData[u.id]]))
				.filter(([, response]) => response != null)
		: Object.entries(telemetryData);

	for (const [unitId, response] of orderedEntries) {
		const unitName = unitsMeta.find((u) => u.id === unitId)?.name || 'Desconocido';
		let hasSignal = false;
		let hasSats = false;
		let hasBattery = false;
		let hasSpeed = false;

		for (const bucket of response.series || []) {
			if (bucket.odometer?.total_distance_mt != null) {
				totalDistance += bucket.odometer.total_distance_mt;
			}
			if (bucket.alerts?.count != null) totalAlerts += bucket.alerts.count;
			// El API (siscom-admin-api) responde snake_case: count_comm_fixable / count_comm_with_fix.
			// Se aceptan variantes camelCase por compatibilidad con despliegues previos.
			const cq = bucket.comm_quality ?? bucket.commQuality;
			if (cq) {
				totalFixableComms +=
					cq.count_comm_fixable ?? cq.countCommFixable ?? cq.fixable_count ?? cq.fixableCount ?? 0;
				totalWithFixComms +=
					cq.count_comm_with_fix ??
					cq.countCommWithFix ??
					cq.with_fix_count ??
					cq.withFixCount ??
					0;
			}
			if (bucket.fuel_consumed_liters != null) totalFuel += bucket.fuel_consumed_liters;
			if (bucket.moving_minutes != null) totalMoving += bucket.moving_minutes;
			if (bucket.idle_minutes != null) totalIdle += bucket.idle_minutes;

			const bucketDate = formatBucketDateShort(bucket.bucket);

			if (!hasSignal && bucket.signal?.avg != null && bucket.signal.avg < 20) {
				offenders.push({
					id: `sig-${unitId}-${bucket.bucket}`,
					type: 'Baja Señal (<20)',
					value: `${bucket.signal.avg.toFixed(1)} rx`,
					date: bucketDate,
					unitName
				});
				hasSignal = true;
			}
			if (!hasSats && bucket.satellites?.avg != null && bucket.satellites.avg < 10) {
				offenders.push({
					id: `sat-${unitId}-${bucket.bucket}`,
					type: 'Bajos Satélites (<10)',
					value: `${Math.round(bucket.satellites.avg)}`,
					date: bucketDate,
					unitName
				});
				hasSats = true;
			}
			const minV = bucket.main_battery?.min_voltage;
			if (!hasBattery && minV != null && minV < 10) {
				offenders.push({
					id: `bat-${unitId}-${bucket.bucket}`,
					type: 'Batería Baja (<10V)',
					value: `${minV.toFixed(1)}V`,
					date: bucketDate,
					unitName
				});
				hasBattery = true;
			}
			const maxSpd = bucket.speed?.max_speed;
			if (!hasSpeed && maxSpd != null && maxSpd > 120) {
				offenders.push({
					id: `spd-${unitId}-${bucket.bucket}`,
					type: 'Exceso Velocidad (>120)',
					value: `${maxSpd.toFixed(1)} km/h`,
					date: bucketDate,
					unitName
				});
				hasSpeed = true;
			}
		}
	}

	return {
		totalDistance,
		totalAlerts,
		totalFixableComms,
		totalWithFixComms,
		totalFuel,
		totalMoving,
		totalIdle,
		offenders
	};
}

/** @param {Date} from @param {Date} to @param {'hour'|'day'} granularity */
export function validateReportRange(from, to, granularity) {
	if (!from || !to) return 'Seleccione fechas válidas.';
	if (from >= to) return 'La fecha de inicio debe ser menor a la fecha fin.';
	const days = (to.getTime() - from.getTime()) / (1000 * 60 * 60 * 24);
	if (granularity === 'hour' && days > 7) {
		return 'Con granularidad de horas, el rango máximo es de 7 días.';
	}
	if (granularity === 'day' && days > 30) {
		return 'Con granularidad de días, el rango máximo sugerido es de 30 días.';
	}
	return null;
}
