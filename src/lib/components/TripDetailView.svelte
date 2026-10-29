<script>
	import Icon from '$lib/components/Icon.svelte';
	import { mapService } from '$lib/services/mapService.js';

	export let trip = null;
	export let onBack = () => {};
	export let onClose = () => {};

	let isPlaying = false;
	let showAlerts = false;
	let playbackProgress = 0;
	/** En móvil: resumen de métricas colapsado para dejar más mapa visible. */
	let statsExpanded = false;
	/** @type {string | null} */
	let _statsTripId = null;

	$: distance = trip?.distance_km != null ? `${trip.distance_km.toFixed(1)} km` : '--';
	$: duration = formatDuration(trip?.duration_minutes);
	$: alertsCount = trip?.alerts?.length || 0;
	$: pointsCount = trip?.points?.length || 0;
	$: if (trip?.id !== _statsTripId) {
		_statsTripId = trip?.id ?? null;
		statsExpanded = false;
	}

	function formatDuration(minutes) {
		if (minutes == null) return '--';
		const m = Math.round(minutes);
		return `${m} min`;
	}

	function togglePlay() {
		if (isPlaying) {
			mapService.pauseTripPlayback();
			isPlaying = false;
			return;
		}
		if (!trip?.points?.length) return;

		// Reanudar desde el punto pausado; no reiniciar la ruta.
		if (mapService.canResumeTripPlayback()) {
			mapService.resumeTripPlayback();
			isPlaying = true;
			return;
		}

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

	/**
	 * Slider en vivo: arrastrarlo mueve el marcador por la ruta. Si no hay
	 * reproducción, se crea una en pausa para poder recorrerla a mano.
	 * @param {Event} e
	 */
	function seek(e) {
		const progress = Number(/** @type {HTMLInputElement} */ (e.currentTarget).value) / 1000;
		if (!trip?.points?.length) return;
		if (!isPlaying && !mapService.canResumeTripPlayback()) {
			mapService.startTripPlayback(trip.points, {
				onProgress: (p) => {
					playbackProgress = p;
				},
				onComplete: () => {
					isPlaying = false;
					playbackProgress = 0;
				}
			});
			mapService.pauseTripPlayback();
		}
		mapService.seekTripPlayback(progress);
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

<div class="flex h-full flex-col bg-white dark:bg-[#0c1829]">
	<!-- Header -->
	<div class="flex items-center justify-between px-4 py-3">
		<button
			type="button"
			class="flex h-10 w-10 items-center justify-center rounded-full text-slate-600 hover:bg-slate-100 dark:text-white/70 dark:hover:bg-white/10"
			on:click={handleBack}
			aria-label="Volver"
		>
			<Icon icon="mdi:chevron-left" width={28} />
		</button>
		<h2 class="text-lg font-semibold text-slate-900 dark:text-white">Detalle del Trayecto</h2>
		<button
			type="button"
			class="flex h-10 w-10 items-center justify-center rounded-full text-slate-600 hover:bg-slate-100 dark:text-white/70 dark:hover:bg-white/10"
			on:click={handleClose}
			aria-label="Cerrar"
		>
			<Icon icon="mdi:close" width={24} />
		</button>
	</div>

	<!-- Playback Controls -->
	<div class="px-4 pb-4">
		<div class="mb-3">
			<p
				class="m-0 text-xs font-semibold uppercase tracking-wide {isPlaying
					? 'text-cyan-600 dark:text-cyan-400'
					: 'text-slate-500 dark:text-white/50'}"
			>
				{isPlaying ? 'Reproduciendo' : 'Trayecto'}
			</p>
			<p class="m-0 text-sm text-slate-600 dark:text-white/70">Controles en vivo</p>
		</div>

		<div class="flex items-center justify-center gap-3">
			<!-- Play/Pause -->
			<button
				type="button"
				class="flex h-12 w-12 shrink-0 items-center justify-center rounded-full {isPlaying
					? 'bg-cyan-500'
					: 'bg-slate-200 dark:bg-white/10'} transition-colors"
				on:click={togglePlay}
				aria-label={isPlaying ? 'Pausar' : 'Reproducir'}
			>
				<Icon
					icon={isPlaying ? 'mdi:pause' : 'mdi:play'}
					width={24}
					class={isPlaying ? 'text-white' : 'text-slate-700 dark:text-white'}
				/>
			</button>

			<!-- Stop: slot fijo para evitar saltos al aparecer/desaparecer -->
			<button
				type="button"
				class="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-red-500 transition-colors {isPlaying ||
				playbackProgress > 0
					? ''
					: 'invisible pointer-events-none'}"
				on:click={stopPlayback}
				aria-label="Detener"
				tabindex={isPlaying || playbackProgress > 0 ? 0 : -1}
				aria-hidden={!(isPlaying || playbackProgress > 0)}
			>
				<Icon icon="mdi:stop" width={24} class="text-white" />
			</button>

			<!-- Alerts Toggle -->
			<button
				type="button"
				class="flex h-12 w-12 shrink-0 items-center justify-center rounded-full {showAlerts
					? 'bg-amber-500'
					: 'bg-slate-200 dark:bg-white/10'} transition-colors"
				on:click={toggleAlerts}
				aria-label={showAlerts ? 'Ocultar alertas' : 'Mostrar alertas'}
			>
				<Icon
					icon="mdi:alert"
					width={24}
					class={showAlerts ? 'text-white' : 'text-slate-700 dark:text-white'}
				/>
			</button>

			<!-- Center -->
			<button
				type="button"
				class="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-slate-200 transition-colors hover:bg-slate-200 dark:bg-white/10 dark:hover:bg-white/20"
				on:click={centerOnRoute}
				aria-label="Centrar en ruta"
			>
				<Icon icon="mdi:crosshairs-gps" width={24} class="text-slate-700 dark:text-white" />
			</button>
		</div>

		<!-- Slider de progreso: se puede arrastrar para recorrer la ruta -->
		<input
			type="range"
			min="0"
			max="1000"
			step="1"
			value={Math.round(playbackProgress * 1000)}
			on:input={seek}
			disabled={!pointsCount}
			class="trip-scrubber mt-3 w-full"
			style="--progress: {playbackProgress * 100}%"
			aria-label="Posición en el recorrido"
			aria-valuetext="{Math.round(playbackProgress * 100)}%"
		/>
	</div>

	<!-- Stats: en móvil colapsable (cerrado al abrir); en sm+ siempre visible -->
	<div class="px-4 pb-4">
		<button
			type="button"
			class="flex w-full items-center justify-between gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-left sm:hidden dark:border-white/10 dark:bg-white/[0.05]"
			on:click={() => (statsExpanded = !statsExpanded)}
			aria-expanded={statsExpanded}
		>
			<div class="min-w-0">
				<p
					class="m-0 text-[11px] font-semibold uppercase tracking-wide text-slate-500 dark:text-white/45"
				>
					Resumen
				</p>
				<p class="m-0 truncate text-[13px] text-slate-700 dark:text-white/70">
					{distance} · {duration} · {alertsCount} alertas
				</p>
			</div>
			<Icon
				icon={statsExpanded ? 'mdi:chevron-up' : 'mdi:chevron-down'}
				width={22}
				class="shrink-0 text-slate-500 dark:text-white/50"
				aria-hidden="true"
			/>
		</button>

		<div class="grid grid-cols-2 gap-3 {statsExpanded ? 'mt-3' : 'hidden'} sm:mt-0 sm:grid">
			<!-- Distance -->
			<div
				class="flex flex-col items-center justify-center rounded-2xl bg-slate-50 py-4 dark:bg-white/5"
			>
				<Icon icon="mdi:swap-horizontal" width={28} class="text-cyan-600 dark:text-cyan-400" />
				<p class="mt-2 text-xl font-bold text-slate-900 dark:text-white">{distance}</p>
				<p class="text-xs text-slate-500 dark:text-white/50">Distancia</p>
			</div>

			<!-- Duration -->
			<div
				class="flex flex-col items-center justify-center rounded-2xl bg-slate-50 py-4 dark:bg-white/5"
			>
				<Icon icon="mdi:clock-outline" width={28} class="text-cyan-600 dark:text-cyan-400" />
				<p class="mt-2 text-xl font-bold text-slate-900 dark:text-white">{duration}</p>
				<p class="text-xs text-slate-500 dark:text-white/50">Duración</p>
			</div>

			<!-- Alerts -->
			<div
				class="flex flex-col items-center justify-center rounded-2xl bg-slate-50 py-4 dark:bg-white/5"
			>
				<Icon icon="mdi:alert-outline" width={28} class="text-amber-400" />
				<p class="mt-2 text-xl font-bold text-slate-900 dark:text-white">{alertsCount}</p>
				<p class="text-xs text-slate-500 dark:text-white/50">Alertas</p>
			</div>

			<!-- Points -->
			<div
				class="flex flex-col items-center justify-center rounded-2xl bg-slate-50 py-4 dark:bg-white/5"
			>
				<Icon icon="mdi:map-marker-multiple" width={28} class="text-emerald-400" />
				<p class="mt-2 text-xl font-bold text-slate-900 dark:text-white">{pointsCount}</p>
				<p class="text-xs text-slate-500 dark:text-white/50">Puntos</p>
			</div>
		</div>
	</div>
</div>

<style>
	/* Pista fina con el tramo recorrido en cian; el pulgar crece al tocarlo. */
	.trip-scrubber {
		appearance: none;
		height: 4px;
		border-radius: 9999px;
		background: linear-gradient(
			to right,
			rgb(34 211 238) var(--progress),
			rgb(148 163 184 / 0.25) var(--progress)
		);
		cursor: pointer;
	}
	.trip-scrubber:focus-visible {
		/* El pulgar ya se ilumina con el foco; el recuadro sobre toda la pista sobra. */
		outline: none;
	}
	.trip-scrubber:disabled {
		cursor: default;
		opacity: 0.5;
	}
	.trip-scrubber::-webkit-slider-thumb {
		appearance: none;
		width: 14px;
		height: 14px;
		border-radius: 9999px;
		background: #fff;
		border: 2px solid rgb(34 211 238);
		box-shadow: 0 0 0 0 rgb(34 211 238 / 0.35);
		transition:
			transform 150ms,
			box-shadow 150ms;
	}
	.trip-scrubber::-moz-range-thumb {
		width: 14px;
		height: 14px;
		border-radius: 9999px;
		background: #fff;
		border: 2px solid rgb(34 211 238);
		transition: transform 150ms;
	}
	.trip-scrubber:hover::-webkit-slider-thumb,
	.trip-scrubber:active::-webkit-slider-thumb,
	.trip-scrubber:focus-visible::-webkit-slider-thumb {
		transform: scale(1.2);
		box-shadow: 0 0 0 6px rgb(34 211 238 / 0.2);
	}
	.trip-scrubber:hover::-moz-range-thumb,
	.trip-scrubber:active::-moz-range-thumb {
		transform: scale(1.2);
	}
</style>
