<script>
	import { onMount, onDestroy } from 'svelte';
	import { Chart, registerables } from 'chart.js';

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

	const darkDefaults = {
		tickColor: 'rgba(255,255,255,0.55)',
		gridColor: 'rgba(255,255,255,0.08)'
	};

	function buildChart() {
		if (!canvas || !config) return;
		if (chart) {
			chart.destroy();
			chart = null;
		}
		chart = new Chart(canvas, {
			type: config.type,
			data: config.data,
			options: {
				responsive: true,
				maintainAspectRatio: false,
				plugins: {
					legend: {
						display: (config.data?.datasets?.length ?? 0) > 1,
						labels: { color: 'rgba(255,255,255,0.7)', boxWidth: 12, font: { size: 11 } }
					},
					...(config.options?.plugins ?? {})
				},
				scales: {
					x: {
						// Etiquetas del eje X completamente verticales (petición de producto)
						ticks: {
							color: darkDefaults.tickColor,
							minRotation: 90,
							maxRotation: 90,
							autoSkip: !expanded,
							...(expanded ? {} : { maxTicksLimit: 6 })
						},
						grid: { color: darkDefaults.gridColor },
						...(config.options?.scales?.x ?? {})
					},
					y: {
						ticks: { color: darkDefaults.tickColor },
						grid: { color: darkDefaults.gridColor },
						...(config.options?.scales?.y ?? {})
					}
				},
				...(config.options ?? {})
			}
		});
	}

	// Solo actualizar data y llamar update — nunca reasignar chart.options
	$: if (canvas && config) {
		if (chart) {
			chart.data = config.data;
			chart.update('none');
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
