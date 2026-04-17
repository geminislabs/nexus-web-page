<script>
	import Icon from '@iconify/svelte';
	import CenterSheet from '$lib/components/CenterSheet.svelte';
	import { theme } from '$lib/stores/themeStore.js';
	import {
		vehicles,
		selectedVehicles,
		loadingVehicles,
		loadingPositions,
		activeVehicles,
		selectedVehicleCount,
		vehicleActions
	} from '$lib/stores/vehicleStore.js';
	import { getStatusText, getStatusPillClass } from '$lib/utils/vehicleUtils.js';
	import { mapService } from '$lib/services/mapService.js';
	import { vehicleActions } from '$lib/stores/vehicleStore.js';
	import { user } from '$lib/stores/auth.js';

	export let showVehiclePanel = false;
	export let showVehicleList = false;
	export let onTogglePanel = () => {};
	export let onClose = () => {};

	const listRegionId = 'vehicle-panel-list-region';

	$: isLightTheme = $theme === 'light';

	async function toggleVehicleList() {
		showVehicleList = !showVehicleList;

		// Si se está abriendo la lista y no hay vehículos cargados, cargarlos
		if (showVehicleList && $vehicles.length === 0) {
			await vehicleActions.loadVehicles();
		}
	}

	async function handleVehicleSelect(unit) {
		selectedUnitId = unit.id;
		const deviceId = unit.device_id || unit.deviceId;

		// Inicializar fecha actual
		const now = new Date();
		const year = now.getFullYear();
		const month = String(now.getMonth() + 1).padStart(2, '0');
		const dayOfMonth = String(now.getDate()).padStart(2, '0');
		currentDate = `${year}-${month}-${dayOfMonth}`;

		// Cargar trayectos
		loadTrips(unit.id);

		if (!deviceId) {
			console.warn('No device ID found for unit:', unit);
			return;
		}

		try {
			// Consultar getLastPosition
			const positionData = await positionService.getLastPosition(deviceId);

			// Actualizar las coordenadas del mapa para ese vehiculo
			if (positionData) {
				vehicleActions.updateVehiclePosition(deviceId, positionData);
			}
		} catch (err) {
			console.error('Error al obtener la posición del vehículo:', err);
		}
	}

	async function loadTrips(unitId) {
		tripsLoading = true;
		tripsError = null;
		trips = [];

		try {
			const response = await apiService.getTrips({
				unit_id: unitId,
				day: currentDate,
				tz: 'America/Mexico_City'
			});

			if (response && response.trips) {
				trips = response.trips;
			}
		} catch (err) {
			console.error('Error al cargar trayectos:', err);
			tripsError = 'Error al cargar trayectos';
		} finally {
			tripsLoading = false;
		}
	}

	async function handleTripClick(trip) {
		if (!trip || !trip.trip_id) return;

		selectedTripId = trip.trip_id;

		// Detener animación anterior si existe
		stopAnimation();

		try {
			// Obtener detalles del trip (puntos y alertas)
			const details = await apiService.getTripDetails(trip.trip_id);

			if (details) {
				// Combinar puntos y alertas
				const points = details.points || [];
				const alerts = details.alerts || [];

				// Unificar formato y ordenar por timestamp
				const allPoints = [
					...points.map((p) => ({ ...p, itemType: 'point' })),
					...alerts.map((a) => ({ ...a, itemType: 'alert' }))
				].sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));

				currentTripPoints = allPoints;

				// Dibujar en el mapa
				mapService.drawTripPolyline(allPoints);
			}
		} catch (err) {
			console.error('Error al cargar detalles del trayecto:', err);
		}
	}

	function togglePlay() {
		if (isPlaying) {
			if (isPaused) {
				mapService.resumeAnimation();
				isPaused = false;
			} else {
				mapService.pauseAnimation();
				isPaused = true;
			}
		} else {
			if (currentTripPoints.length > 0) {
				const duration = currentTripPoints.length < 20 ? 10000 : 20000;
				mapService.animateTrip(currentTripPoints, duration, () => {
					stopAnimation();
				});
				isPlaying = true;
				isPaused = false;
			}
		}
	}

		if (vehiclesWithCoords.length > 0) {
			mapService.centerOnVehicles(vehiclesWithCoords);
		}
	}

	function centerOnVehicle(vehicle) {
		if ((vehicle.latitude || vehicle.lat) && (vehicle.longitude || vehicle.lng)) {
			mapService.centerOnVehicle(vehicle);
		}
	}

	function vehicleCoords(vehicle) {
		const lat = vehicle.latitude ?? vehicle.lat;
		const lng = vehicle.longitude ?? vehicle.lng;
		if (lat == null || lng == null) return null;
		return { lat, lng };
	}
</script>

<button
	type="button"
	on:click={onTogglePanel}
	aria-label="Abrir panel de control de vehículos"
	aria-haspopup="dialog"
	aria-expanded={showVehiclePanel}
	class="flex h-12 w-12 shrink-0 items-center justify-center rounded-full text-white shadow-lg transition-all duration-200 hover:scale-110 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-400 focus-visible:ring-offset-transparent {isLightTheme
		? 'border border-slate-600/45 bg-gradient-to-br from-slate-700 to-slate-900 shadow-[0_2px_6px_rgb(15_23_42_/_0.2)] [box-shadow:inset_0_1px_0_rgb(255_255_255_/_0.08)] hover:brightness-[1.07]'
		: 'border border-white/10 bg-white/10 hover:bg-white/[0.16]'}"
	class:ring-2={showVehiclePanel}
	class:ring-emerald-400={showVehiclePanel}
	class:ring-offset-2={showVehiclePanel}
	class:ring-offset-slate-900={showVehiclePanel && isLightTheme}
	class:ring-offset-slate-950={showVehiclePanel && !isLightTheme}
>
	<Icon icon="mdi:car-side" class="h-8 w-8 shrink-0" aria-hidden="true" />
</button>

			{#if loading}
				<div class="flex items-center justify-center py-8">
					<svg
						class="animate-spin h-6 w-6"
						xmlns="http://www.w3.org/2000/svg"
						fill="none"
						viewBox="0 0 24 24"
						style="color: var(--accent-cyan)"
					>
						<circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"
						></circle>
						<path
							class="opacity-75"
							fill="currentColor"
							d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
						></path>
					</svg>
				</div>
			{:else if error}
				<div class="text-center py-4">
					<p class="text-sm text-red-400 mb-2">{error}</p>
					<button on:click={loadUserUnits} class="text-xs text-accent-cyan hover:underline">
						Reintentar
					</button>
				</div>
			{:else if units.length === 0}
				<p class="text-sm text-app opacity-60 py-8 text-center">No tienes vehículos asignados</p>
			{:else}
				<div class="space-y-3 max-h-[60vh] overflow-y-auto custom-scrollbar pr-1">
					{#each units as unit}
						<div
							class="unit-card p-3 rounded-lg bg-[var(--btn-secondary-bg)] border border-[var(--panel-border)] hover:bg-[var(--btn-secondary-hover-bg)] transition-colors cursor-pointer"
							on:click={() => handleVehicleSelect(unit)}
							on:keydown={(e) => e.key === 'Enter' && handleVehicleSelect(unit)}
							role="button"
							tabindex="0"
						>
							<div class="flex justify-between items-start mb-2">
								<h3 class="font-bold text-app text-lg tracking-wide">
									{unit.name}
								</h3>
								{#if isMaster && selectedUnitId === unit.id}
									<button
										class="p-2 rounded-full transition-all duration-300 text-accent-cyan {shareError[
											unit.id
										]
											? 'glow-red'
											: 'hover:bg-white/10'}"
										on:click|stopPropagation={() => handleShareClick(unit)}
										title="Compartir ubicación"
										aria-label="Compartir ubicación"
										disabled={sharingLoading}
									>
										<svg
											xmlns="http://www.w3.org/2000/svg"
											width="20"
											height="20"
											viewBox="0 0 24 24"
											fill="none"
											stroke="currentColor"
											stroke-width="2"
											stroke-linecap="round"
											stroke-linejoin="round"
										>
											<circle cx="18" cy="5" r="3"></circle>
											<circle cx="6" cy="12" r="3"></circle>
											<circle cx="18" cy="19" r="3"></circle>
											<line x1="8.59" y1="13.51" x2="15.42" y2="17.49"></line>
											<line x1="15.41" y1="6.51" x2="8.59" y2="10.49"></line>
										</svg>
									</button>
								{/if}
							</div>

							{#if shareUrls[unit.id]}
								<div
									class="mt-2 p-2 text-xs break-all"
									on:click|stopPropagation
									on:keydown|stopPropagation
									role="button"
									tabindex="0"
								>
									<div class="flex items-center gap-2 justify-between">
										<span class="text-app/80 font-mono"
											>Expira: {formatDate(shareUrls[unit.id].expires_at)}</span
										>
										<button
											class="text-accent-cyan p-1 rounded transition-all duration-300 {copySuccess[
												unit.id
											]
												? 'glow-green'
												: ''} {copyError[unit.id] ? 'glow-red' : 'hover:text-white'}"
											on:click|stopPropagation={() =>
												copyToClipboard(shareUrls[unit.id].url, unit.id)}
											title="Copiar enlace"
											aria-label="Copiar enlace"
										>
											<svg
												xmlns="http://www.w3.org/2000/svg"
												width="16"
												height="16"
												viewBox="0 0 24 24"
												fill="none"
												stroke="currentColor"
												stroke-width="2"
												stroke-linecap="round"
												stroke-linejoin="round"
											>
												<rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
												<path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
											</svg>
										</button>
									</div>
								</div>
							{/if}
						</div>
					{/each}
				</div>
			{/if}

			<!-- Sección de Trayectos -->
			{#if selectedUnitId}
				<div class="mt-6 border-t border-[var(--panel-border)] pt-4">
					<h3 class="text-app font-bold uppercase tracking-wider text-sm mb-3 block w-full">
						Trayectos del día
					</h3>
					<div class="flex justify-between items-center mb-3">
						<div class="flex items-center gap-2">
							{#if currentTripPoints.length > 0}
								<div class="flex gap-1">
									<button
										class="p-1 rounded hover:bg-white/10 text-accent-cyan transition-colors"
										on:click={togglePlay}
										title={isPlaying && !isPaused ? 'Pausar' : 'Reproducir'}
										aria-label={isPlaying && !isPaused ? 'Pausar' : 'Reproducir'}
									>
										{#if isPlaying && !isPaused}
											<svg
												xmlns="http://www.w3.org/2000/svg"
												width="16"
												height="16"
												viewBox="0 0 24 24"
												fill="none"
												stroke="currentColor"
												stroke-width="2"
												stroke-linecap="round"
												stroke-linejoin="round"
												><rect x="6" y="4" width="4" height="16"></rect><rect
													x="14"
													y="4"
													width="4"
													height="16"
												></rect></svg
											>
										{:else}
											<svg
												xmlns="http://www.w3.org/2000/svg"
												width="16"
												height="16"
												viewBox="0 0 24 24"
												fill="none"
												stroke="currentColor"
												stroke-width="2"
												stroke-linecap="round"
												stroke-linejoin="round"><polygon points="5 3 19 12 5 21 5 3"></polygon></svg
											>
										{/if}
									</button>
									<button
										class="p-1 rounded hover:bg-white/10 text-red-400 transition-colors"
										on:click={stopAnimation}
										title="Detener"
										aria-label="Detener"
									>
										<svg
											xmlns="http://www.w3.org/2000/svg"
											width="16"
											height="16"
											viewBox="0 0 24 24"
											fill="none"
											stroke="currentColor"
											stroke-width="2"
											stroke-linecap="round"
											stroke-linejoin="round"
											><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect></svg
										>
									</button>
								</div>
							{/if}
						</div>
						{#if currentDate}
							<input
								type="date"
								bind:value={currentDate}
								on:change={() => loadTrips(selectedUnitId)}
								class="bg-transparent text-xs text-accent-cyan font-mono border-none focus:ring-0 cursor-pointer p-0 text-right w-24"
								style="color-scheme: dark;"
							/>
						{/if}
					</div>

					{#if tripsLoading}
						<div class="flex justify-center py-4">
							<svg
								class="animate-spin h-5 w-5 text-accent-cyan"
								xmlns="http://www.w3.org/2000/svg"
								fill="none"
								viewBox="0 0 24 24"
							>
								<circle
									class="opacity-25"
									cx="12"
									cy="12"
									r="10"
									stroke="currentColor"
									stroke-width="4"
								></circle>
								<path
									class="opacity-75"
									fill="currentColor"
									d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
								></path>
							</svg>
						</div>
					{:else if tripsError}
						<p class="text-xs text-red-400 text-center">{tripsError}</p>
					{:else if trips.length === 0}
						<p class="text-xs text-app opacity-60 text-center italic">Sin trayectos</p>
					{:else}
						<div class="space-y-2 max-h-[30vh] overflow-y-auto custom-scrollbar pr-1">
							{#each trips as trip}
								<div
									class="p-2 rounded bg-[var(--btn-secondary-bg)] border border-[var(--panel-border)] text-xs cursor-pointer hover:bg-[var(--btn-secondary-hover-bg)] transition-colors {selectedTripId ===
									trip.trip_id
										? 'bg-[var(--btn-secondary-hover-bg)] border-accent-cyan'
										: ''}"
									on:click={() => handleTripClick(trip)}
									on:keydown={(e) => e.key === 'Enter' && handleTripClick(trip)}
									role="button"
									tabindex="0"
								>
									<div class="flex justify-between items-center">
										<div class="flex gap-2">
											<span class="text-app opacity-70">Inicio:</span>
											<span class="font-mono text-accent-cyan"
												>{formatTime(trip.start_timestamp)}</span
											>
										</div>
										<div class="flex gap-2">
											<span class="text-app opacity-70">Fin:</span>
											<span class="font-mono text-accent-cyan"
												>{formatTime(trip.end_timestamp)}</span
											>
										</div>
									</div>
								</div>
							{/each}
						</div>
					{/if}
				</div>
			{/if}
		</div>
	</div>
{/if}

<style>
	.unit-card {
		box-shadow: 0 2px 5px rgba(0, 0, 0, 0.1);
	}
	.glow-red {
		box-shadow: 0 0 10px red;
		color: red;
	}
	.glow-green {
		box-shadow: 0 0 10px var(--accent-cyan);
		color: var(--accent-cyan);
	}
</style>
