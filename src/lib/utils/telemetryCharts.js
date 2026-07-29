import { formatBucketLabel, getUnitChartColor } from './telemetryUtils.js';

/**
 * @param {Record<string, { series?: Array<Record<string, unknown>> }>} telemetryData
 * @param {Array<{ id: string, name: string }>} unitOrder
 * @param {(bucket: Record<string, unknown>) => number | null | undefined} getValue
 */
function buildMultiSeries(telemetryData, unitOrder, getValue) {
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
			data: labels.map((lb) => {
				const v = getValue(byBucket.get(lb));
				return v == null ? null : v;
			}),
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
			data: rawLabels.map((lb) => {
				const v = byBucket.get(lb)?.speed?.avg_speed;
				return v == null ? null : v;
			}),
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
			data: rawLabels.map((lb) => {
				const v = byBucket.get(lb)?.speed?.max_speed;
				return v == null ? null : v;
			}),
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
			scales: { y: { title: { display: true, text: 'km/h', color: '#94a3b8' } } },
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
		data: buildMultiSeries(telemetryData, unitOrder, (b) => b?.main_battery?.avg_voltage),
		options: {
			scales: { y: { title: { display: true, text: 'V', color: '#94a3b8' } } }
		}
	};
}

export function backupBatteryChartConfig(telemetryData, unitOrder) {
	return {
		type: 'line',
		data: buildMultiSeries(telemetryData, unitOrder, (b) => b?.backup_battery?.avg_voltage),
		options: {
			scales: { y: { title: { display: true, text: 'V', color: '#94a3b8' } } }
		}
	};
}

export function distanceChartConfig(telemetryData, unitOrder) {
	return {
		type: 'bar',
		data: buildMultiSeries(telemetryData, unitOrder, (b) => {
			const d = b?.odometer?.total_distance_mt;
			return d != null && d > 0 ? d : null;
		}),
		options: {
			scales: { y: { title: { display: true, text: 'metros', color: '#94a3b8' } } }
		}
	};
}

export function fuelChartConfig(telemetryData, unitOrder) {
	return {
		type: 'bar',
		data: buildMultiSeries(telemetryData, unitOrder, (b) => b?.fuel_consumed_liters),
		options: {
			scales: { y: { title: { display: true, text: 'L', color: '#94a3b8' } } }
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
			data: labels.map((lb) => byBucket.get(lb)?.moving_minutes ?? null),
			backgroundColor: color + '99',
			stack: u.id
		});
		idleDs.push({
			label: `${u.name} — detenido`,
			data: labels.map((lb) => byBucket.get(lb)?.idle_minutes ?? null),
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
				y: { stacked: true, title: { display: true, text: 'min', color: '#94a3b8' } }
			}
		}
	};
}

export function signalChartConfig(telemetryData, unitOrder) {
	return {
		type: 'line',
		data: buildMultiSeries(telemetryData, unitOrder, (b) => b?.signal?.avg),
		options: { scales: { y: { title: { display: true, text: 'rx', color: '#94a3b8' } } } }
	};
}

/**
 * Gráfica de satélites con área + línea (igual que iOS AreaMark + LineMark)
 */
export function satellitesChartConfig(telemetryData, unitOrder) {
	const baseData = buildMultiSeries(telemetryData, unitOrder, (b) => b?.satellites?.avg);
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
				y: {
					title: { display: true, text: 'satélites', color: '#94a3b8' },
					beginAtZero: true
				}
			}
		}
	};
}
