<script>
	import Icon from '@iconify/svelte';
	import { browser } from '$app/environment';
	import { onDestroy, tick } from 'svelte';
	import ChartPanel from './ChartPanel.svelte';
	import {
		speedChartConfig,
		mainBatteryChartConfig,
		backupBatteryChartConfig,
		distanceChartConfig,
		fuelChartConfig,
		movingIdleChartConfig,
		signalChartConfig,
		satellitesChartConfig
	} from '$lib/utils/telemetryCharts.js';

	export let telemetryData = {};
	export let unitOrder = [];
	/** Grid de 2 columnas en escritorio */
	export let wide = false;

	/** @type {{ title: string, icon: string, iconClass: string, cfg: object } | null} */
	let expandedChart = null;
	/** @type {HTMLDivElement | undefined} */
	let expandPortalHost;

	$: charts = unitOrder.length
		? [
				{
					id: 'speed',
					title: 'Velocidad Promedio e Histórica',
					icon: 'mdi:speedometer',
					iconClass: 'text-blue-500',
					cfg: speedChartConfig(telemetryData, unitOrder),
					span2: true,
					height: wide ? 220 : 200
				},
				{
					id: 'main-battery',
					title: 'Batería del vehículo',
					icon: 'mdi:battery',
					iconClass: 'text-emerald-500',
					cfg: mainBatteryChartConfig(telemetryData, unitOrder),
					height: wide ? 180 : 160
				},
				{
					id: 'backup-battery',
					title: 'Batería interna (respaldo)',
					icon: 'mdi:battery-charging-80',
					iconClass: 'text-amber-500',
					cfg: backupBatteryChartConfig(telemetryData, unitOrder),
					height: wide ? 180 : 160
				},
				{
					id: 'distance',
					title: 'Distancia recorrida (m)',
					icon: 'mdi:map-marker-distance',
					iconClass: 'text-violet-400',
					cfg: distanceChartConfig(telemetryData, unitOrder),
					height: wide ? 200 : 180
				},
				{
					id: 'fuel',
					title: 'Combustible consumido',
					icon: 'mdi:gas-station',
					iconClass: 'text-orange-400',
					cfg: fuelChartConfig(telemetryData, unitOrder),
					height: wide ? 180 : 160
				},
				{
					id: 'activity',
					title: 'Tiempos operativos',
					icon: 'mdi:chart-timeline-variant',
					iconClass: 'text-blue-400',
					cfg: movingIdleChartConfig(telemetryData, unitOrder),
					span2: true,
					height: wide ? 200 : 180
				},
				{
					id: 'signal',
					title: 'Señal (rx)',
					icon: 'mdi:signal',
					iconClass: 'text-blue-400',
					cfg: signalChartConfig(telemetryData, unitOrder),
					height: wide ? 140 : 120
				},
				{
					id: 'satellites',
					title: 'Satélites',
					icon: 'mdi:satellite-variant',
					iconClass: 'text-cyan-400',
					cfg: satellitesChartConfig(telemetryData, unitOrder),
					height: wide ? 140 : 120
				}
			]
		: [];

	/** Ancho mínimo del lienzo expandido: espacio por bucket para leer todas las etiquetas */
	$: expandedMinWidth = expandedChart
		? Math.max(640, (expandedChart.cfg?.data?.labels?.length ?? 0) * 48)
		: 0;

	$: if (browser && expandedChart && expandPortalHost) {
		tick().then(() => {
			if (expandPortalHost && expandPortalHost.parentNode !== document.body) {
				document.body.appendChild(expandPortalHost);
			}
		});
	}

	function openExpanded(chart) {
		expandedChart = chart;
	}

	function closeExpanded() {
		expandedChart = null;
	}

	function onWindowKeydown(e) {
		if (e.key === 'Escape' && expandedChart) closeExpanded();
	}

	onDestroy(() => {
		if (browser && expandPortalHost && expandPortalHost.parentNode === document.body) {
			// eslint-disable-next-line svelte/no-dom-manipulating -- intentional portal teardown
			expandPortalHost.remove();
		}
	});

	const cardClass =
		'rounded-2xl border border-slate-200 bg-white p-4 dark:border-white/10 dark:bg-white/[0.04]';
</script>

<svelte:window on:keydown={onWindowKeydown} />

<div class={wide ? 'grid gap-4 pb-6 sm:gap-5 lg:grid-cols-2 lg:gap-5 xl:gap-6' : 'space-y-5 pb-8'}>
	{#each charts as chart (chart.id)}
		<article class="{cardClass} {wide && chart.span2 ? 'lg:col-span-2' : ''}">
			<div class="mb-3 flex items-center justify-between gap-2">
				<h3
					class="m-0 flex items-center gap-2 text-sm font-semibold text-slate-900 dark:text-white"
				>
					<Icon icon={chart.icon} class={chart.iconClass} width={18} />
					{chart.title}
				</h3>
				<button
					type="button"
					class="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700 dark:text-white/40 dark:hover:bg-white/10 dark:hover:text-white"
					on:click={() => openExpanded(chart)}
					aria-label="Expandir gráfica {chart.title}"
					title="Expandir gráfica"
				>
					<Icon icon="mdi:arrow-expand" width={16} aria-hidden="true" />
				</button>
			</div>
			{#if chart.cfg}<ChartPanel config={chart.cfg} height={chart.height} />{/if}
		</article>
	{/each}
</div>

{#if expandedChart}
	<div bind:this={expandPortalHost}>
		<div
			class="fixed inset-0 z-[400] flex items-center justify-center bg-slate-900/50 p-3 backdrop-blur-sm sm:p-6 dark:bg-black/60"
			role="presentation"
			on:click|self={closeExpanded}
		>
			<div
				class="flex max-h-[92vh] w-full max-w-5xl flex-col rounded-2xl border border-slate-200 bg-white p-4 shadow-2xl sm:p-5 dark:border-white/10 dark:bg-[#0f1626]"
				role="dialog"
				aria-modal="true"
				aria-label={expandedChart.title}
			>
				<div class="mb-3 flex items-center justify-between gap-2">
					<h3
						class="m-0 flex items-center gap-2 text-base font-semibold text-slate-900 dark:text-white"
					>
						<Icon icon={expandedChart.icon} class={expandedChart.iconClass} width={20} />
						{expandedChart.title}
					</h3>
					<button
						type="button"
						class="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-800 dark:text-white/60 dark:hover:bg-white/10 dark:hover:text-white"
						on:click={closeExpanded}
						aria-label="Cerrar gráfica expandida"
						title="Cerrar"
					>
						<Icon icon="mdi:close" width={20} aria-hidden="true" />
					</button>
				</div>
				<!-- Scroll horizontal: el lienzo crece según la cantidad de buckets -->
				<div class="overflow-x-auto overscroll-x-contain">
					<div style="min-width: {expandedMinWidth}px">
						<ChartPanel config={expandedChart.cfg} height={420} expanded />
					</div>
				</div>
			</div>
		</div>
	</div>
{/if}
