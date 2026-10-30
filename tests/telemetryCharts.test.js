import { describe, it, expect } from 'vitest';
import {
	roundChartValue,
	backupBatteryChartConfig,
	distanceChartConfig,
	speedChartConfig
} from '../src/lib/utils/telemetryCharts.js';

const units = [{ id: 'u1', name: 'Unidad 1' }];

describe('roundChartValue', () => {
	it('recorta el ruido de coma flotante', () => {
		expect(roundChartValue(4.199999999999998, 2)).toBe(4.2);
		expect(roundChartValue(4.200000000000001, 2)).toBe(4.2);
		expect(roundChartValue(7712.4, 0)).toBe(7712);
		expect(roundChartValue('12.345', 1)).toBe(12.3);
	});

	it('los huecos siguen siendo huecos', () => {
		expect(roundChartValue(null, 2)).toBeNull();
		expect(roundChartValue(undefined, 2)).toBeNull();
		expect(roundChartValue('', 2)).toBeNull();
		expect(roundChartValue(Number.NaN, 2)).toBeNull();
		expect(roundChartValue(0, 2)).toBe(0);
	});
});

describe('gráficas de telemetría', () => {
	const data = {
		u1: {
			series: [
				{
					bucket: '2026-10-29T14:00:00Z',
					backup_battery: { avg_voltage: 4.199999999999998 },
					odometer: { total_distance_mt: 7712.38 },
					speed: { avg_speed: 41.66666666666667, max_speed: 88.00000000000001 }
				},
				{
					bucket: '2026-10-29T15:00:00Z',
					backup_battery: { avg_voltage: 4.200000000000001 },
					odometer: { total_distance_mt: 0 },
					speed: { avg_speed: null }
				}
			]
		}
	};

	it('la batería de respaldo sale con dos decimales y el eje también', () => {
		const cfg = backupBatteryChartConfig(data, units);
		expect(cfg.data.datasets[0].data).toEqual([4.2, 4.2]);
		expect(cfg.options.scales.y.ticks.precision).toBe(2);
		expect(cfg.options.scales.y.title.text).toBe('V');
	});

	it('la distancia en metros enteros, sin barras en cero', () => {
		const cfg = distanceChartConfig(data, units);
		expect(cfg.data.datasets[0].data).toEqual([7712, null]);
		expect(cfg.options.scales.y.ticks.precision).toBe(0);
	});

	it('la velocidad promedio y máxima con un decimal', () => {
		const cfg = speedChartConfig(data, units);
		expect(cfg.data.datasets[0].data).toEqual([41.7, null]);
		expect(cfg.data.datasets[1].data).toEqual([88, null]);
	});
});
