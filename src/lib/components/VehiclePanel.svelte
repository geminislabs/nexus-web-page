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

	function toggleVehicleSelection(vehicleId) {
		vehicleActions.toggleVehicleSelection(vehicleId);
	}

	function selectAllVehicles() {
		vehicleActions.selectAllVehicles();
	}

	function clearVehicleSelection() {
		vehicleActions.clearSelection();
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

	async function trackSelectedVehicles() {
		const selectedVehiclesList = $vehicles.filter((v) => $selectedVehicles.includes(v.id));
		const vehiclesWithCoords = selectedVehiclesList.filter(
			(v) => (v.latitude || v.lat) && (v.longitude || v.lng)
		);

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

<CenterSheet open={showVehiclePanel} title="Vehículos" onClose={() => onClose()}>
	<div class="space-y-5">
		<section class="space-y-3" aria-labelledby="vehicle-panel-actions-heading">
			<h3 id="vehicle-panel-actions-heading" class="sr-only">Acciones del panel de vehículos</h3>
			<button
				type="button"
				class="flex w-full items-center justify-center gap-2 rounded-xl border border-emerald-600/20 bg-emerald-600 px-4 py-3 text-sm font-semibold text-white shadow-md shadow-emerald-900/20 transition-colors hover:bg-emerald-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-500 dark:border-emerald-500/30 dark:shadow-emerald-950/40"
				on:click={toggleVehicleList}
				aria-expanded={showVehicleList}
				aria-controls={listRegionId}
			>
				<Icon icon="mdi:view-list-outline" class="h-5 w-5 shrink-0" aria-hidden="true" />
				{showVehicleList ? 'Ocultar lista de vehículos' : 'Ver lista de vehículos'}
			</button>

			{#if showVehicleList}
				<div
					id={listRegionId}
					role="region"
					aria-label="Lista y selección de vehículos"
					class="max-h-64 overflow-y-auto overscroll-contain rounded-xl border border-slate-200 bg-slate-50 p-3 dark:border-slate-600 dark:bg-slate-800/80"
				>
					<div class="mb-3 flex flex-wrap items-center justify-between gap-2">
						<h4 class="text-sm font-semibold text-slate-800 dark:text-slate-100">Selección</h4>
						<div
							class="flex flex-wrap gap-2"
							role="group"
							aria-label="Acciones de selección masiva"
						>
							<button
								type="button"
								class="rounded-lg border border-blue-600/30 bg-blue-600 px-2.5 py-1.5 text-xs font-semibold text-white shadow-sm transition-colors hover:bg-blue-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500"
								on:click={selectAllVehicles}
							>
								Seleccionar todos
							</button>
							<button
								type="button"
								class="rounded-lg border border-slate-400/40 bg-slate-600 px-2.5 py-1.5 text-xs font-semibold text-white shadow-sm transition-colors hover:bg-slate-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-400 dark:border-slate-500 dark:bg-slate-700 dark:hover:bg-slate-600"
								on:click={clearVehicleSelection}
							>
								Limpiar selección
							</button>
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

					{#if $loadingVehicles || $loadingPositions}
						<div
							class="flex items-center justify-center gap-2 py-6"
							role="status"
							aria-live="polite"
							aria-busy="true"
						>
							<div
								class="h-6 w-6 shrink-0 animate-spin rounded-full border-2 border-slate-200 border-b-blue-600 dark:border-slate-600 dark:border-b-blue-400"
								aria-hidden="true"
							></div>
							<span class="text-sm text-slate-600 dark:text-slate-300">
								{$loadingVehicles ? 'Cargando vehículos…' : 'Actualizando posiciones…'}
							</span>
						</div>
					{:else if $vehicles.length > 0}
						<ul class="list-none space-y-1 p-0">
							{#each $vehicles as vehicle (vehicle.id)}
								{@const coords = vehicleCoords(vehicle)}
								<li
									class="rounded-lg border border-transparent p-2 transition-colors hover:border-slate-200/80 hover:bg-white/90 dark:hover:border-slate-600/60 dark:hover:bg-slate-700/50"
								>
									<div class="flex items-start gap-3">
										<input
											id="vehicle-select-{vehicle.id}"
											type="checkbox"
											checked={$selectedVehicles.includes(vehicle.id)}
											class="mt-1 size-4 shrink-0 rounded border-slate-300 text-blue-600 focus:ring-2 focus:ring-blue-500 focus:ring-offset-0 dark:border-slate-500 dark:bg-slate-900 dark:text-blue-500"
											aria-label="Incluir {vehicle.name} en la selección del mapa"
											aria-describedby="vehicle-meta-{vehicle.id}"
											on:change={() => toggleVehicleSelection(vehicle.id)}
										/>
										<div class="min-w-0 flex-1" id="vehicle-meta-{vehicle.id}">
											<div class="flex items-start justify-between gap-2">
												<button
													type="button"
													class="truncate text-left text-sm font-semibold text-slate-900 underline-offset-2 hover:text-blue-600 hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500 disabled:cursor-not-allowed disabled:opacity-50 disabled:no-underline dark:text-slate-100 dark:hover:text-blue-400"
													on:click={() => centerOnVehicle(vehicle)}
													disabled={!coords}
													aria-label="Centrar el mapa en {vehicle.name}"
												>
													{vehicle.name}
												</button>
												<span
													class="inline-flex shrink-0 items-center rounded-full px-2 py-0.5 text-xs font-semibold {getStatusPillClass(
														vehicle.status
													)}"
												>
													{getStatusText(vehicle.status)}
												</span>
											</div>
											<dl class="mt-1 space-y-0.5 text-xs text-slate-600 dark:text-slate-400">
												<div class="flex flex-wrap gap-x-1">
													<dt class="font-medium text-slate-500 dark:text-slate-500">Conductor</dt>
													<dd>{vehicle.driver || 'Sin conductor'}</dd>
												</div>
												<div class="flex flex-wrap gap-x-1">
													<dt class="font-medium text-slate-500 dark:text-slate-500">Ubicación</dt>
													<dd>{vehicle.location || 'Desconocida'}</dd>
												</div>
												{#if vehicle.deviceId}
													<div class="flex flex-wrap gap-x-1">
														<dt class="font-medium text-slate-500 dark:text-slate-500">
															Dispositivo
														</dt>
														<dd class="font-mono text-[0.6875rem]">{vehicle.deviceId}</dd>
													</div>
												{/if}
												{#if coords}
													<div class="flex flex-wrap gap-x-1">
														<dt class="font-medium text-slate-500 dark:text-slate-500">
															Coordenadas
														</dt>
														<dd class="font-mono text-[0.6875rem]">
															{coords.lat.toFixed(4)}, {coords.lng.toFixed(4)}
														</dd>
													</div>
												{/if}
												{#if vehicle.speed !== undefined}
													<div class="flex flex-wrap gap-x-1">
														<dt class="font-medium text-slate-500 dark:text-slate-500">
															Movimiento
														</dt>
														<dd>
															{vehicle.speed} km/h · Batería {vehicle.battery ?? 0}%
														</dd>
													</div>
												{/if}
												{#if vehicle.lastUpdateFormatted}
													<div class="flex flex-wrap gap-x-1">
														<dt class="font-medium text-slate-500 dark:text-slate-500">
															Última actualización
														</dt>
														<dd>{vehicle.lastUpdateFormatted}</dd>
													</div>
												{/if}
											</dl>
										</div>
									</div>
								</li>
							{/each}
						</ul>

						{#if $selectedVehicleCount > 0}
							<div
								class="mt-3 border-t border-slate-200 pt-3 dark:border-slate-600"
								role="status"
								aria-live="polite"
							>
								<p class="mb-2 text-xs font-medium text-slate-600 dark:text-slate-300">
									{$selectedVehicleCount} unidad{$selectedVehicleCount !== 1 ? 'es' : ''} seleccionada{$selectedVehicleCount !==
									1
										? 's'
										: ''}
								</p>
								<button
									type="button"
									class="w-full rounded-lg border border-emerald-600/25 bg-emerald-600 px-3 py-2.5 text-xs font-semibold text-white shadow-sm transition-colors hover:bg-emerald-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-500"
									on:click={trackSelectedVehicles}
								>
									Rastrear seleccionados en el mapa
								</button>
							</div>
						{/if}
					{:else}
						<p class="py-6 text-center text-sm text-slate-500 dark:text-slate-400" role="status">
							No hay vehículos disponibles
						</p>
					{/if}
				</div>
			{/if}

			<button
				type="button"
				class="flex w-full items-center justify-center gap-2 rounded-xl border border-blue-600/25 bg-blue-600 px-4 py-3 text-sm font-semibold text-white shadow-md shadow-blue-900/25 transition-colors hover:bg-blue-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500 disabled:pointer-events-none disabled:opacity-60 dark:border-blue-500/30 dark:shadow-blue-950/40"
				on:click={refreshPositions}
				disabled={$loadingPositions}
				aria-busy={$loadingPositions}
			>
				<Icon
					icon="mdi:refresh"
					class="h-5 w-5 shrink-0 {$loadingPositions ? 'animate-spin' : ''}"
					aria-hidden="true"
				/>
				Actualizar posiciones
			</button>
		</section>

		<section
			class="rounded-xl border border-slate-200 bg-slate-50/80 p-3 dark:border-slate-600 dark:bg-slate-800/50"
			aria-labelledby="vehicle-panel-status-heading"
		>
			<h3
				id="vehicle-panel-status-heading"
				class="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400"
			>
				Estado del sistema
			</h3>
			<ul class="list-none space-y-2 p-0 text-xs text-slate-700 dark:text-slate-200">
				<li class="flex items-center gap-2">
					<span
						class="h-2 w-2 shrink-0 animate-pulse rounded-full bg-emerald-500"
						aria-hidden="true"
					></span>
					<span
						>Conectado · {$activeVehicles.length} unidad{$activeVehicles.length !== 1 ? 'es' : ''} activa{$activeVehicles.length !==
						1
							? 's'
							: ''}</span
					>
				</li>
				{#if $selectedVehicleCount > 0}
					<li class="flex items-center gap-2">
						<span class="h-2 w-2 shrink-0 rounded-full bg-blue-500" aria-hidden="true"></span>
						<span>
							{$selectedVehicleCount} en selección para seguimiento
						</span>
					</li>
				{/if}
			</ul>
		</section>
	</div>
</CenterSheet>
