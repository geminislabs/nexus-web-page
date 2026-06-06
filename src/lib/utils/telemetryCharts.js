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
 * @param {Record<string, { series?: Array<Record<string, unknown>> }>} telemetryData
 * @param {Array<{ id: string, name: string }>} unitOrder
 */
export function speedChartConfig(telemetryData, unitOrder) {
	return {
		type: 'line',
		data: buildMultiSeries(telemetryData, unitOrder, (b) => b?.speed?.avg_speed),
		options: { scales: { y: { title: { display: true, text: 'km/h', color: '#94a3b8' } } } }
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

export function satellitesChartConfig(telemetryData, unitOrder) {
	return {
		type: 'line',
		data: buildMultiSeries(telemetryData, unitOrder, (b) => b?.satellites?.avg),
		options: {
			scales: { y: { title: { display: true, text: '#', color: '#94a3b8' } } }
		}
	};
}
