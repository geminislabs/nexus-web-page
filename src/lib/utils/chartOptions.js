export const CHART_DARK_DEFAULTS = {
	tickColor: 'rgba(255,255,255,0.55)',
	gridColor: 'rgba(255,255,255,0.08)'
};

/**
 * Opciones de Chart.js para las gráficas de informes: los valores base del
 * panel más lo que pida cada gráfica.
 *
 * La mezcla es por niveles (plugins, cada eje y sus `ticks`). Antes se hacía
 * `...config.options` al final y su `scales` reemplazaba entero al del panel,
 * así que las etiquetas verticales del eje X y el color de marcas y rejilla
 * nunca se aplicaban.
 *
 * @param {{ data?: { datasets?: unknown[] }, options?: Record<string, any> } | null} config
 * @param {{ expanded?: boolean, animation?: false | Record<string, unknown> }} [opts]
 */
export function buildChartOptions(config, { expanded = false, animation = false } = {}) {
	const { plugins = {}, scales = {}, ...rest } = config?.options ?? {};
	const { x = {}, y = {}, ...otherScales } = scales;

	return {
		responsive: true,
		maintainAspectRatio: false,
		animation,
		// El tooltip sigue al cursor por el eje X sin tener que apuntar
		// exactamente a una barra o un punto.
		interaction: { mode: 'index', intersect: false },
		...rest,
		plugins: {
			legend: {
				display: (config?.data?.datasets?.length ?? 0) > 1,
				labels: { color: 'rgba(255,255,255,0.7)', boxWidth: 12, font: { size: 11 } }
			},
			...plugins
		},
		scales: {
			...otherScales,
			x: {
				grid: { color: CHART_DARK_DEFAULTS.gridColor },
				...x,
				// Etiquetas del eje X completamente verticales (petición de producto)
				ticks: {
					color: CHART_DARK_DEFAULTS.tickColor,
					minRotation: 90,
					maxRotation: 90,
					autoSkip: !expanded,
					...(expanded ? {} : { maxTicksLimit: 6 }),
					...(x.ticks ?? {})
				}
			},
			y: {
				grid: { color: CHART_DARK_DEFAULTS.gridColor },
				...y,
				ticks: { color: CHART_DARK_DEFAULTS.tickColor, ...(y.ticks ?? {}) }
			}
		}
	};
}
