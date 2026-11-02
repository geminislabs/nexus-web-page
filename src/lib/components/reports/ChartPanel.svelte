<script>
	import { onMount, onDestroy } from 'svelte';
	import { Chart, registerables } from 'chart.js';
	import { reducedMotion } from '$lib/motion/index.js';
	import { buildChartOptions } from '$lib/utils/chartOptions.js';

	export let config = null;
	export let height = 200;
	/** Modal expandido: muestra todas las etiquetas (sin autoSkip) */
	export let expanded = false;

	let canvas = null;
	let chart = null;

	// Registrar una sola vez a nivel de módulo con guard
	if (!Chart._nexusRegistered) {
		Chart.register(...registerables);
		Chart._nexusRegistered = true;
	}

	function buildChart() {
		if (!canvas || !config) return;
		if (chart) {
			chart.destroy();
			chart = null;
		}
		chart = new Chart(canvas, {
			type: config.type,
			data: config.data,
			// Al cambiar los datos, barras y líneas se transforman hasta los
			// valores nuevos en lugar de redibujarse de golpe.
			options: buildChartOptions(config, {
				expanded,
				animation: reducedMotion() ? false : { duration: 600, easing: 'easeOutCubic' }
			})
		});
	}

	// Solo actualizar data y llamar update — nunca reasignar chart.options
	$: if (canvas && config) {
		if (chart) {
			chart.data = config.data;
			chart.update(reducedMotion() ? 'none' : undefined);
		} else {
			buildChart();
		}
	}

	onMount(() => buildChart());
	onDestroy(() => {
		chart?.destroy();
		chart = null;
	});
</script>

<div class="relative w-full" style="height: {height}px">
	<canvas bind:this={canvas} class="h-full w-full"></canvas>
</div>
