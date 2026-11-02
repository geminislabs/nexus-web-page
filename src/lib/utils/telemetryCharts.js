import { formatBucketLabel, getUnitChartColor } from './telemetryUtils.js';

/**
 * Decimales que se muestran por magnitud. La API manda promedios en coma
 * flotante (p. ej. 4.199999999999998 V) y Chart.js los imprime tal cual en el
 * tooltip y en los extremos del eje.
 */
export const CHART_DECIMALS = {
	voltage: 2,
	liters: 2,
	speed: 1,
	signal: 1,
	satellites: 1,
	minutes: 1,
	meters: 0
};

/**
 * @param {unknown} value
 * @param {number} decimals
 * @returns {number | null}
 */
export function roundChartValue(value, decimals) {
	if (value == null || value === '') return null;
	const n = Number(value);
	if (!Number.isFinite(n)) return null;
	const f = 10 ** decimals;
	return Math.round(n * f) / f;
}

/**
 * Eje Y con la misma precisión que los datos: sin esto, una serie casi plana
 * (4.19–4.20 V) genera marcas como 4.200000000000001.
 * @param {string} unit
 * @param {number} decimals
 * @param {Record<string, unknown>} [extra]
 */
function yAxis(unit, decimals, extra = {}) {
	return {
		title: { display: true, text: unit, color: '#94a3b8' },
		ticks: { precision: decimals },
		...extra
	};
}

/**
 * @param {Record<string, { series?: Array<Record<string, unknown>> }>} telemetryData
 * @param {Array<{ id: string, name: string }>} unitOrder
 * @param {(bucket: Record<string, unknown>) => number | null | undefined} getValue
 * @param {number} decimals
 */
function buildMultiSeries(telemetryData, unitOrder, getValue, decimals) {
	/** @type {Set<string>} */
	const labelsSet = new Set();
	for (const entry of Object.values(telemetryData)) {
		for (const b of entry.series || []) {
			if (b.bucket) labelsSet.add(String(b.bucket));
		}
	}
	const labels = [...labelsSet].sort();
	const datasets = unitOrder.map((u, idx) => {
		const series = telemetryData[u.id]?.series || [];
		const byBucket = new Map(series.map((b) => [String(b.bucket), b]));
		return {
			label: u.name,
			data: labels.map((lb) => roundChartValue(getValue(byBucket.get(lb)), decimals)),
			borderColor: getUnitChartColor(u.id, idx),
			backgroundColor: getUnitChartColor(u.id, idx) + '33',
			borderWidth: 2,
			pointRadius: 0,
			spanGaps: true,
			tension: 0.25
		};
	});
	return {
		labels: labels.map(formatBucketLabel),
		datasets
	};
}

/**
 * Gráfica de velocidad con línea de promedio + puntos de máxima (igual que iOS/Android)
 * @param {Record<string, { series?: Array<Record<string, unknown>> }>} telemetryData
 * @param {Array<{ id: string, name: string }>} unitOrder
 */
export function speedChartConfig(telemetryData, unitOrder) {
	// Obtener todos los labels de bucket ordenados
	const labelsSet = new Set();
	for (const entry of Object.values(telemetryData)) {
		for (const b of entry.series || []) {
			if (b.bucket) labelsSet.add(String(b.bucket));
		}
	}
	const rawLabels = [...labelsSet].sort();
	const labels = rawLabels.map(formatBucketLabel);

	// Serie de velocidad promedio (línea) + máxima (puntos)
	const avgDatasets = [];
	const maxDatasets = [];

	unitOrder.forEach((u, idx) => {
		const series = telemetryData[u.id]?.series || [];
		const byBucket = new Map(series.map((b) => [String(b.bucket), b]));
		const color = getUnitChartColor(u.id, idx);

		// Velocidad promedio (línea)
		avgDatasets.push({
			label: u.name,
			data: rawLabels.map((lb) =>
				roundChartValue(byBucket.get(lb)?.speed?.avg_speed, CHART_DECIMALS.speed)
			),
			borderColor: color,
			backgroundColor: color + '33',
			borderWidth: 2,
			pointRadius: 0,
			spanGaps: true,
			tension: 0.25
		});

		// Velocidad máxima (puntos semitransparentes) — igual que iOS PointMark
		maxDatasets.push({
			label: `${u.name} (máx)`,
			data: rawLabels.map((lb) =>
				roundChartValue(byBucket.get(lb)?.speed?.max_speed, CHART_DECIMALS.speed)
			),
			borderColor: color + '50',
			backgroundColor: color + '30',
			borderWidth: 0,
			pointRadius: 3,
			pointStyle: 'circle',
			showLine: false,
			spanGaps: true
		});
	});

	return {
		type: 'line',
		data: {
			labels,
			datasets: [...avgDatasets, ...maxDatasets]
		},
		options: {
			scales: { y: yAxis('km/h', CHART_DECIMALS.speed) },
			plugins: {
				legend: {
					display: unitOrder.length > 1,
					labels: { color: 'rgba(255,255,255,0.7)', boxWidth: 12, font: { size: 10 } }
				}
			}
		}
	};
}

export function mainBatteryChartConfig(telemetryData, unitOrder) {
	return {
		type: 'line',
		data: buildMultiSeries(
			telemetryData,
			unitOrder,
			(b) => b?.main_battery?.avg_voltage,
			CHART_DECIMALS.voltage
		),
		options: {
			scales: { y: yAxis('V', CHART_DECIMALS.voltage) }
		}
	};
}

export function backupBatteryChartConfig(telemetryData, unitOrder) {
	return {
		type: 'line',
		data: buildMultiSeries(
			telemetryData,
			unitOrder,
			(b) => b?.backup_battery?.avg_voltage,
			CHART_DECIMALS.voltage
		),
		options: {
			scales: { y: yAxis('V', CHART_DECIMALS.voltage) }
		}
	};
}

export function distanceChartConfig(telemetryData, unitOrder) {
	return {
		type: 'bar',
		data: buildMultiSeries(
			telemetryData,
			unitOrder,
			(b) => {
				const d = b?.odometer?.total_distance_mt;
				return d != null && d > 0 ? d : null;
			},
			CHART_DECIMALS.meters
		),
		options: {
			scales: { y: yAxis('metros', CHART_DECIMALS.meters) }
		}
	};
}

export function fuelChartConfig(telemetryData, unitOrder) {
	return {
		type: 'bar',
		data: buildMultiSeries(
			telemetryData,
			unitOrder,
			(b) => b?.fuel_consumed_liters,
			CHART_DECIMALS.liters
		),
		options: {
			scales: { y: yAxis('L', CHART_DECIMALS.liters) }
		}
	};
}

export function movingIdleChartConfig(telemetryData, unitOrder) {
	const labelsSet = new Set();
	for (const entry of Object.values(telemetryData)) {
		for (const b of entry.series || []) labelsSet.add(String(b.bucket));
	}
	const labels = [...labelsSet].sort();
	const movingDs = [];
	const idleDs = [];
	unitOrder.forEach((u, idx) => {
		const series = telemetryData[u.id]?.series || [];
		const byBucket = new Map(series.map((b) => [String(b.bucket), b]));
		const color = getUnitChartColor(u.id, idx);
		movingDs.push({
			label: `${u.name} — movimiento`,
			data: labels.map((lb) =>
				roundChartValue(byBucket.get(lb)?.moving_minutes, CHART_DECIMALS.minutes)
			),
			backgroundColor: color + '99',
			stack: u.id
		});
		idleDs.push({
			label: `${u.name} — detenido`,
			data: labels.map((lb) =>
				roundChartValue(byBucket.get(lb)?.idle_minutes, CHART_DECIMALS.minutes)
			),
			backgroundColor: color + '44',
			stack: u.id
		});
	});
	return {
		type: 'bar',
		data: {
			labels: labels.map(formatBucketLabel),
			datasets: [...movingDs, ...idleDs]
		},
		options: {
			scales: {
				x: { stacked: true },
				y: yAxis('min', CHART_DECIMALS.minutes, { stacked: true })
			}
		}
	};
}

export function signalChartConfig(telemetryData, unitOrder) {
	return {
		type: 'line',
		data: buildMultiSeries(telemetryData, unitOrder, (b) => b?.signal?.avg, CHART_DECIMALS.signal),
		options: { scales: { y: yAxis('rx', CHART_DECIMALS.signal) } }
	};
}

/**
 * Gráfica de satélites con área + línea (igual que iOS AreaMark + LineMark)
 */
export function satellitesChartConfig(telemetryData, unitOrder) {
	const baseData = buildMultiSeries(
		telemetryData,
		unitOrder,
		(b) => b?.satellites?.avg,
		CHART_DECIMALS.satellites
	);
	// Agregar fill a cada dataset
	const datasetsWithFill = baseData.datasets.map((ds, idx) => ({
		...ds,
		fill: true,
		backgroundColor: getUnitChartColor(unitOrder[idx]?.id, idx) + '25'
	}));
	return {
		type: 'line',
		data: {
			labels: baseData.labels,
			datasets: datasetsWithFill
		},
		options: {
			scales: {
				y: yAxis('satélites', CHART_DECIMALS.satellites, { beginAtZero: true })
			}
		}
	};
}
