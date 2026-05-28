<script>
	import Icon from '@iconify/svelte';
	import { mapService } from '$lib/services/mapService.js';

	export let trip = null;
	export let onBack = () => {};
	export let onClose = () => {};

	let isPlaying = false;
	let showAlerts = false;
	let playbackProgress = 0;

	$: distance = trip?.distance_km != null ? `${trip.distance_km.toFixed(1)} km` : '--';
	$: duration = formatDuration(trip?.duration_minutes);
	$: alertsCount = trip?.alerts?.length || 0;
	$: pointsCount = trip?.points?.length || 0;

	function formatDuration(minutes) {
		if (minutes == null) return '--';
		const m = Math.round(minutes);
		return `${m} min`;
	}

	function togglePlay() {
		if (isPlaying) {
			mapService.pauseTripPlayback();
			isPlaying = false;
		} else {
			if (!trip?.points?.length) return;
			mapService.startTripPlayback(trip.points, {
				onProgress: (progress) => {
					playbackProgress = progress;
				},
				onComplete: () => {
					isPlaying = false;
					playbackProgress = 0;
				}
			});
			isPlaying = true;
		}
	}

	function stopPlayback() {
		mapService.stopTripPlayback();
		isPlaying = false;
		playbackProgress = 0;
	}

	function toggleAlerts() {
		showAlerts = !showAlerts;
		if (showAlerts && trip?.alerts?.length) {
			mapService.showTripAlerts(trip.alerts);
		} else {
			mapService.hideTripAlerts();
		}
	}

	function centerOnRoute() {
		if (trip?.points?.length) {
			mapService.fitBoundsToPoints(trip.points);
		}
	}

	function handleBack() {
		stopPlayback();
		mapService.hideTripAlerts();
		onBack();
	}

	function handleClose() {
		stopPlayback();
		mapService.hideTripAlerts();
		mapService.clearTripRoute();
		onClose();
	}
</script>

<div class="flex h-full flex-col bg-[#0c1829]">
	<!-- Header -->
	<div class="flex items-center justify-between px-4 py-3">
		<button
			type="button"
			class="flex h-10 w-10 items-center justify-center rounded-full text-white/70 hover:bg-white/10"
			on:click={handleBack}
			aria-label="Volver"
		>
			<Icon icon="mdi:chevron-left" width={28} />
		</button>
		<h2 class="text-lg font-semibold text-white">Detalle del Trayecto</h2>
		<button
			type="button"
			class="flex h-10 w-10 items-center justify-center rounded-full text-white/70 hover:bg-white/10"
			on:click={handleClose}
			aria-label="Cerrar"
		>
			<Icon icon="mdi:close" width={24} />
		</button>
	</div>

	<!-- Playback Controls -->
	<div class="px-4 pb-4">
		<div class="flex items-center gap-3">
			<div class="flex-1">
				<p
					class="text-xs font-semibold uppercase tracking-wide {isPlaying
						? 'text-cyan-400'
						: 'text-white/50'}"
				>
					{isPlaying ? 'Reproduciendo' : 'Trayecto'}
				</p>
				<p class="text-sm text-white/70">Controles en vivo</p>
			</div>

			<!-- Play/Pause -->
			<button
				type="button"
				class="flex h-12 w-12 items-center justify-center rounded-full {isPlaying
					? 'bg-cyan-500'
					: 'bg-white/10'} transition-colors"
				on:click={togglePlay}
				aria-label={isPlaying ? 'Pausar' : 'Reproducir'}
			>
				<Icon icon={isPlaying ? 'mdi:pause' : 'mdi:play'} width={24} class="text-white" />
			</button>

			<!-- Stop -->
			{#if isPlaying || playbackProgress > 0}
				<button
					type="button"
					class="flex h-12 w-12 items-center justify-center rounded-full bg-red-500 transition-colors"
					on:click={stopPlayback}
					aria-label="Detener"
				>
					<Icon icon="mdi:stop" width={24} class="text-white" />
				</button>
			{/if}

			<!-- Alerts Toggle -->
			<button
				type="button"
				class="flex h-12 w-12 items-center justify-center rounded-full {showAlerts
					? 'bg-amber-500'
					: 'bg-white/10'} transition-colors"
				on:click={toggleAlerts}
				aria-label={showAlerts ? 'Ocultar alertas' : 'Mostrar alertas'}
			>
				<Icon icon="mdi:alert" width={24} class="text-white" />
			</button>

			<!-- Center -->
			<button
				type="button"
				class="flex h-12 w-12 items-center justify-center rounded-full bg-white/10 transition-colors hover:bg-white/20"
				on:click={centerOnRoute}
				aria-label="Centrar en ruta"
			>
				<Icon icon="mdi:crosshairs-gps" width={24} class="text-white" />
			</button>
		</div>

		<!-- Progress bar -->
		{#if isPlaying || playbackProgress > 0}
			<div class="mt-3 h-1 overflow-hidden rounded-full bg-white/10">
				<div
					class="h-full bg-cyan-400 transition-all duration-100"
					style="width: {playbackProgress * 100}%"
				></div>
			</div>
		{/if}
	</div>

	<!-- Stats Grid -->
	<div class="grid grid-cols-2 gap-3 px-4 pb-4">
		<!-- Distance -->
		<div class="flex flex-col items-center justify-center rounded-2xl bg-white/5 py-4">
			<Icon icon="mdi:swap-horizontal" width={28} class="text-cyan-400" />
			<p class="mt-2 text-xl font-bold text-white">{distance}</p>
			<p class="text-xs text-white/50">Distancia</p>
		</div>

		<!-- Duration -->
		<div class="flex flex-col items-center justify-center rounded-2xl bg-white/5 py-4">
			<Icon icon="mdi:clock-outline" width={28} class="text-cyan-400" />
			<p class="mt-2 text-xl font-bold text-white">{duration}</p>
			<p class="text-xs text-white/50">Duración</p>
		</div>

		<!-- Alerts -->
		<div class="flex flex-col items-center justify-center rounded-2xl bg-white/5 py-4">
			<Icon icon="mdi:alert-outline" width={28} class="text-amber-400" />
			<p class="mt-2 text-xl font-bold text-white">{alertsCount}</p>
			<p class="text-xs text-white/50">Alertas</p>
		</div>

		<!-- Points -->
		<div class="flex flex-col items-center justify-center rounded-2xl bg-white/5 py-4">
			<Icon icon="mdi:map-marker-multiple" width={28} class="text-emerald-400" />
			<p class="mt-2 text-xl font-bold text-white">{pointsCount}</p>
			<p class="text-xs text-white/50">Puntos</p>
		</div>
	</div>
</div>
