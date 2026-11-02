import { describe, it, expect } from 'vitest';
import { buildChartOptions, CHART_DARK_DEFAULTS } from '../src/lib/utils/chartOptions.js';
import {
	backupBatteryChartConfig,
	movingIdleChartConfig
} from '../src/lib/utils/telemetryCharts.js';

const units = [{ id: 'u1', name: 'Unidad 1' }];

describe('buildChartOptions', () => {
	it('el eje de cada gráfica no borra los valores del panel', () => {
		const opts = buildChartOptions(backupBatteryChartConfig({}, units));
		expect(opts.scales.x.ticks).toMatchObject({
			minRotation: 90,
			maxRotation: 90,
			maxTicksLimit: 6
		});
		expect(opts.scales.x.grid.color).toBe(CHART_DARK_DEFAULTS.gridColor);
		expect(opts.scales.y.ticks).toEqual({ color: CHART_DARK_DEFAULTS.tickColor, precision: 2 });
		expect(opts.scales.y.title.text).toBe('V');
		expect(opts.scales.y.grid.color).toBe(CHART_DARK_DEFAULTS.gridColor);
	});

	it('conserva las opciones propias de la gráfica (apiladas)', () => {
		const opts = buildChartOptions(movingIdleChartConfig({}, units));
		expect(opts.scales.x.stacked).toBe(true);
		expect(opts.scales.y.stacked).toBe(true);
		expect(opts.scales.x.ticks.minRotation).toBe(90);
	});

	it('expandida muestra todas las etiquetas', () => {
		const opts = buildChartOptions(backupBatteryChartConfig({}, units), { expanded: true });
		expect(opts.scales.x.ticks.autoSkip).toBe(false);
		expect(opts.scales.x.ticks).not.toHaveProperty('maxTicksLimit');
	});

	it('la leyenda solo aparece con varias series, salvo que la gráfica la defina', () => {
		expect(buildChartOptions({ data: { datasets: [{}] } }).plugins.legend.display).toBe(false);
		expect(buildChartOptions({ data: { datasets: [{}, {}] } }).plugins.legend.display).toBe(true);
		const custom = buildChartOptions({ options: { plugins: { legend: { display: true } } } });
		expect(custom.plugins.legend).toEqual({ display: true });
		expect(custom.interaction).toEqual({ mode: 'index', intersect: false });
	});
});
