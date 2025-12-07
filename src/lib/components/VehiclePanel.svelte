<script>
	import { onMount } from 'svelte';
	import { apiService } from '$lib/services/api.js';
	import { positionService } from '$lib/services/positionService.js';
	import { mapService } from '$lib/services/mapService.js';
	import { vehicleActions } from '$lib/stores/vehicleStore.js';
	import { user } from '$lib/stores/auth.js';

	export let showVehiclePanel = false;
	export let toggleVehiclePanel = null;
	export let embedded = false;

	let units = [];
	let loading = false;
	let error = null;
	let selectedUnitId = null;
	let shareUrls = {}; // { [unitId]: { url: string, expires_at: string } }
	let sharingLoading = false;
	let shareError = {}; // { [unitId]: boolean }
	let copySuccess = {}; // { [unitId]: boolean }
	let copyError = {}; // { [unitId]: boolean }

	// Trayectos
	let trips = [];
	let tripsLoading = false;
	let tripsError = null;
	let currentDate = '';
	let selectedTripId = null;

	// Animación
	let isPlaying = false;
	let isPaused = false;
	let currentTripPoints = [];

	$: currentUser = $user;
	$: isMaster = currentUser?.is_master === true;

	async function loadUserUnits() {
		loading = true;
		error = null;
		try {
			units = await apiService.getUserUnits();
		} catch (err) {
			console.error('Error al cargar unidades del usuario:', err);
			error = err.message || 'Error al cargar unidades';
		} finally {
			loading = false;
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

	function stopAnimation() {
		mapService.stopAnimation();
		isPlaying = false;
		isPaused = false;
	}

	// URL de la compañía para enlaces compartidos
	const COMPANY_URL = import.meta.env.VITE_COMPANY_URL || 'http://localhost:5174';

	async function handleShareClick(unit) {
		if (sharingLoading) return;

		sharingLoading = true;
		shareError = { ...shareError, [unit.id]: false };

		try {
			const response = await apiService.shareLocation(unit.id);
			if (response.token) {
				const url = `http://nexus.geminislabs.com/share/${response.token}`;
				shareUrls = {
					...shareUrls,
					[unit.id]: {
						url,
						expires_at: response.expires_at
					}
				};
			} else {
				throw new Error('No token received');
			}
		} catch (err) {
			console.error('Error sharing location:', err);
			shareError = { ...shareError, [unit.id]: true };
			setTimeout(() => {
				shareError = { ...shareError, [unit.id]: false };
			}, 1500);
		} finally {
			sharingLoading = false;
		}
	}

	function copyToClipboard(text, unitId) {
		if (navigator.clipboard) {
			navigator.clipboard
				.writeText(text)
				.then(() => {
					copySuccess = { ...copySuccess, [unitId]: true };
					setTimeout(() => {
						copySuccess = { ...copySuccess, [unitId]: false };
					}, 1500);
				})
				.catch(() => {
					copyError = { ...copyError, [unitId]: true };
					setTimeout(() => {
						copyError = { ...copyError, [unitId]: false };
					}, 1500);
				});
		} else {
			copyError = { ...copyError, [unitId]: true };
			setTimeout(() => {
				copyError = { ...copyError, [unitId]: false };
			}, 1500);
		}
	}

	function formatDate(dateString) {
		if (!dateString) return '';
		return new Date(dateString).toLocaleString();
	}

	function formatTime(dateString) {
		if (!dateString) return '';
		return new Date(dateString).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
	}

	// Cargar unidades cuando se muestra el panel
	$: if (showVehiclePanel || embedded) {
		loadUserUnits();
	}
</script>

<!-- Botón del vehículo (solo si no está embebido) -->
{#if !embedded}
	<button
		on:click={toggleVehiclePanel || (() => (showVehiclePanel = !showVehiclePanel))}
		aria-label="Abrir panel de vehículos"
		class="nav-button"
	>
		<svg
			class="menu-icon"
			fill="currentColor"
			viewBox="-12.29 -12.29 147.46 147.46"
			version="1.1"
			id="Layer_1"
			xmlns="http://www.w3.org/2000/svg"
			xmlns:xlink="http://www.w3.org/1999/xlink"
			style="enable-background:new 0 0 122.88 92.02"
			xml:space="preserve"
		>
			<g>
				<path
					d="M10.17,34.23c-10.98-5.58-9.72-11.8,1.31-11.15l2.47,4.63l5.09-15.83C21.04,5.65,24.37,0,30.9,0H96 c6.53,0,10.29,5.54,11.87,11.87l3.82,15.35l2.2-4.14c11.34-0.66,12.35,5.93,0.35,11.62l1.95,2.99c7.89,8.11,7.15,22.45,5.92,42.48 v8.14c0,2.04-1.67,3.71-3.71,3.71h-15.83c-2.04,0-3.71-1.67-3.71-3.71v-4.54H24.04v4.54c0,2.04-1.67,3.71-3.71,3.71H4.5 c-2.04,0-3.71-1.67-3.71-3.71V78.2c0-0.2,0.02-0.39,0.04-0.58C-0.37,62.25-2.06,42.15,10.17,34.23L10.17,34.23z M30.38,58.7 l-14.06-1.77c-3.32-0.37-4.21,1.03-3.08,3.89l1.52,3.69c0.49,0.95,1.14,1.64,1.9,2.12c0.89,0.55,1.96,0.82,3.15,0.87l12.54,0.1 c3.03-0.01,4.34-1.22,3.39-4C34.96,60.99,33.18,59.35,30.38,58.7L30.38,58.7z M54.38,52.79h14.4c0.85,0,1.55,0.7,1.55,1.55l0,0 c0,0.85-0.7,1.55-1.55,1.55h-14.4c-0.85,0-1.55-0.7-1.55-1.55l0,0C52.82,53.49,53.52,52.79,54.38,52.79L54.38,52.79z M89.96,73.15 h14.4c0.85,0,1.55,0.7,1.55,1.55l0,0c0,0.85-0.7,1.55-1.55,1.55h-14.4c-0.85,0-1.55-0.7-1.55-1.55l0,0 C88.41,73.85,89.1,73.15,89.96,73.15L89.96,73.15z M92.5,58.7l14.06-1.77c3.32-0.37,4.21,1.03,3.08,3.89l-1.52,3.69 c-0.49,0.95-1.14,1.64-1.9,2.12c-0.89,0.55-1.96,0.82-3.15,0.87l-12.54,0.1c-3.03-0.01-4.34-1.22-3.39-4 C87.92,60.99,89.7,59.35,92.5,58.7L92.5,58.7z M18.41,73.15h14.4c0.85,0,1.55,0.7,1.55,1.55l0,0c0,0.85-0.7,1.55-1.55,1.55h-14.4 c-0.85,0-1.55-0.7-1.55-1.55l0,0C16.86,73.85,17.56,73.15,18.41,73.15L18.41,73.15z M19.23,31.2h86.82l-3.83-15.92 c-1.05-4.85-4.07-9.05-9.05-9.05H33.06c-4.97,0-7.52,4.31-9.05,9.05L19.23,31.2v0.75V31.2L19.23,31.2z"
				/>
			</g>
		</svg>
	</button>
{/if}

<!-- Panel de contenido -->
{#if showVehiclePanel || embedded}
	<div class={embedded ? '' : 'menu-card'}>
		<div class="controls">
			<p
				class="text-center text-lg font-bold uppercase tracking-widest mb-12 text-app opacity-100 border-b border-[var(--panel-border)] pb-3"
			>
				Mis Veh&iacute;culos
			</p>

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
