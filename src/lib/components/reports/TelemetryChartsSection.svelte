<script>
	import Icon from '@iconify/svelte';
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

	$: speedCfg = unitOrder.length ? speedChartConfig(telemetryData, unitOrder) : null;
	$: mainBatCfg = unitOrder.length ? mainBatteryChartConfig(telemetryData, unitOrder) : null;
	$: backupBatCfg = unitOrder.length ? backupBatteryChartConfig(telemetryData, unitOrder) : null;
	$: distCfg = unitOrder.length ? distanceChartConfig(telemetryData, unitOrder) : null;
	$: fuelCfg = unitOrder.length ? fuelChartConfig(telemetryData, unitOrder) : null;
	$: activityCfg = unitOrder.length ? movingIdleChartConfig(telemetryData, unitOrder) : null;
	$: signalCfg = unitOrder.length ? signalChartConfig(telemetryData, unitOrder) : null;
	$: satsCfg = unitOrder.length ? satellitesChartConfig(telemetryData, unitOrder) : null;

	const cardClass =
		'rounded-2xl border border-slate-200 bg-white p-4 dark:border-white/10 dark:bg-white/[0.04]';
</script>

<div class={wide ? 'grid gap-4 pb-6 sm:gap-5 lg:grid-cols-2 lg:gap-5 xl:gap-6' : 'space-y-5 pb-8'}>
	<article class="{cardClass} {wide ? 'lg:col-span-2' : ''}">
		<h3 class="mb-3 flex items-center gap-2 text-sm font-semibold text-slate-900 dark:text-white">
			<Icon icon="mdi:speedometer" class="text-blue-500" width={18} />
			Velocidad promedio
		</h3>
		{#if speedCfg}<ChartPanel config={speedCfg} height={wide ? 220 : 200} />{/if}
	</article>

	<article class={cardClass}>
		<h3 class="mb-3 flex items-center gap-2 text-sm font-semibold text-slate-900 dark:text-white">
			<Icon icon="mdi:battery" class="text-emerald-500" width={18} />
			Batería del vehículo
		</h3>
		{#if mainBatCfg}<ChartPanel config={mainBatCfg} height={wide ? 180 : 160} />{/if}
	</article>

	<article class={cardClass}>
		<h3 class="mb-3 flex items-center gap-2 text-sm font-semibold text-slate-900 dark:text-white">
			<Icon icon="mdi:battery-charging-80" class="text-amber-500" width={18} />
			Batería interna (respaldo)
		</h3>
		{#if backupBatCfg}<ChartPanel config={backupBatCfg} height={wide ? 180 : 160} />{/if}
	</article>

	<article class={cardClass}>
		<h3 class="mb-3 flex items-center gap-2 text-sm font-semibold text-slate-900 dark:text-white">
			<Icon icon="mdi:map-marker-distance" class="text-violet-400" width={18} />
			Distancia recorrida (m)
		</h3>
		{#if distCfg}<ChartPanel config={distCfg} height={wide ? 200 : 180} />{/if}
	</article>

	<article class={cardClass}>
		<h3 class="mb-3 flex items-center gap-2 text-sm font-semibold text-slate-900 dark:text-white">
			<Icon icon="mdi:gas-station" class="text-orange-400" width={18} />
			Combustible consumido
		</h3>
		{#if fuelCfg}<ChartPanel config={fuelCfg} height={wide ? 180 : 160} />{/if}
	</article>

	<article class={wide ? `${cardClass} lg:col-span-2` : cardClass}>
		<h3 class="mb-3 flex items-center gap-2 text-sm font-semibold text-slate-900 dark:text-white">
			<Icon icon="mdi:chart-timeline-variant" class="text-blue-400" width={18} />
			Tiempos operativos
		</h3>
		{#if activityCfg}<ChartPanel config={activityCfg} height={wide ? 200 : 180} />{/if}
	</article>

	<article class={cardClass}>
		<h3 class="mb-3 flex items-center gap-2 text-xs font-semibold text-slate-900 dark:text-white">
			<Icon icon="mdi:signal" class="text-blue-400" width={16} />
			Señal (rx)
		</h3>
		{#if signalCfg}<ChartPanel config={signalCfg} height={wide ? 140 : 120} />{/if}
	</article>

	<article class={cardClass}>
		<h3 class="mb-3 flex items-center gap-2 text-xs font-semibold text-slate-900 dark:text-white">
			<Icon icon="mdi:satellite-variant" class="text-cyan-400" width={16} />
			Satélites
		</h3>
		{#if satsCfg}<ChartPanel config={satsCfg} height={wide ? 140 : 120} />{/if}
	</article>
</div>
