import { writable, derived, get } from 'svelte/store';
import { apiService } from '$lib/services/api.js';
import { vehicles } from '$lib/stores/vehicleStore.js';
import {
	TELEMETRY_METRICS,
	processTelemetryResults,
	validateReportRange
} from '$lib/utils/telemetryUtils.js';

/** @typedef {{ device_id?: string, series: Array<Record<string, unknown>> }} TelemetryEntry */

export const selectedReportUnitIds = writable(/** @type {Set<string>} */ (new Set()));
export const reportFrom = writable(defaultFrom());
export const reportTo = writable(new Date());
export const reportGranularity = writable('hour');
export const loadingTelemetry = writable(false);
export const telemetryError = writable(/** @type {string | null} */ (null));
/** @type {import('svelte/store').Writable<Record<string, TelemetryEntry>>} */
export const telemetryData = writable({});

export const telemetryTotals = writable({
	totalDistance: 0,
	totalAlerts: 0,
	totalFixableComms: 0,
	totalWithFixComms: 0,
	totalFuel: 0,
	totalMoving: 0,
	totalIdle: 0,
	offenders: []
});

export const hasTelemetryResults = derived(telemetryData, ($d) => Object.keys($d).length > 0);

function defaultFrom() {
	const d = new Date();
	d.setDate(d.getDate() - 1);
	return d;
}

function toIso(d) {
	return d instanceof Date ? d.toISOString() : new Date(d).toISOString();
}

export const telemetryActions = {
	toggleUnit(unitId) {
		selectedReportUnitIds.update((set) => {
			const next = new Set(set);
			if (next.has(unitId)) next.delete(unitId);
			else if (next.size < 3) next.add(unitId);
			return next;
		});
	},

	clearSelection() {
		selectedReportUnitIds.set(new Set());
	},

	async fetchReport() {
		const unitIds = [...get(selectedReportUnitIds)];
		const from = get(reportFrom);
		const to = get(reportTo);
		const granularity = get(reportGranularity);

		if (unitIds.length === 0) {
			telemetryError.set('Seleccione al menos una unidad.');
			return;
		}

		const validation = validateReportRange(from, to, granularity);
		if (validation) {
			telemetryError.set(validation);
			return;
		}

		const allVehicles = get(vehicles);
		loadingTelemetry.set(true);
		telemetryError.set(null);
		telemetryData.set({});
		telemetryTotals.set({
			totalDistance: 0,
			totalAlerts: 0,
			totalFixableComms: 0,
			totalWithFixComms: 0,
			totalFuel: 0,
			totalMoving: 0,
			totalIdle: 0,
			offenders: []
		});

		const fromStr = toIso(from);
		const toStr = toIso(to);

		try {
			/** @type {Record<string, TelemetryEntry>} */
			const dataMap = {};
			// Orden de selección estable (no según qué request termina primero)
			const unitsMeta = unitIds
				.map((unitId) => {
					const unit = allVehicles.find((v) => v.id === unitId);
					return unit?.deviceId ? { id: unitId, name: unit.name, deviceId: unit.deviceId } : null;
				})
				.filter(Boolean);

			await Promise.all(
				unitsMeta.map(async ({ id, deviceId }) => {
					const response = await apiService.getDeviceTelemetry(deviceId, {
						from: fromStr,
						to: toStr,
						granularity,
						metrics: TELEMETRY_METRICS
					});
					dataMap[id] = response;
				})
			);

			if (Object.keys(dataMap).length === 0) {
				telemetryError.set('Las unidades seleccionadas no tienen dispositivo asignado.');
				return;
			}

			telemetryData.set(dataMap);
			telemetryTotals.set(processTelemetryResults(dataMap, unitsMeta));
		} catch (err) {
			telemetryError.set(err?.message || 'Error al generar el informe');
		} finally {
			loadingTelemetry.set(false);
		}
	}
};
