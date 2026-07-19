<script>
	import Icon from '@iconify/svelte';
	import { onMount } from 'svelte';
	import CenterSheet from '$lib/components/CenterSheet.svelte';
	import ColoredVehicleIcon from '$lib/components/Unit/ColoredVehicleIcon.svelte';
	import { theme } from '$lib/stores/themeStore.js';
	import {
		vehicles,
		selectedVehicles,
		loadingVehicles,
		loadingPositions,
		selectedVehicleCount,
		vehicleActions
	} from '$lib/stores/vehicleStore.js';
	import {
		getStatusText,
		getStatusPillClass,
		colorSlugToHex,
		getSpeedColor
	} from '$lib/utils/vehicleUtils.js';
	import { unitIcons } from '$lib/data/unitIcons';
	import { mapService } from '$lib/services/mapService.js';

	export let showVehiclePanel = false;
	export let onTogglePanel = () => {};
	export let onClose = () => {};
	/** Cuando true (Sidebar), muestra la lista inline sin FAB ni CenterSheet. */
	export let embedded = false;

	/** @type {'all' | 'active' | 'inactive'} */
	let statusFilter = 'all';
	let searchQuery = '';

	$: isLightTheme = $theme === 'light';

	$: activeCount = $vehicles.filter((v) => v.status === 'active').length;
	$: inactiveCount = $vehicles.filter((v) => v.status !== 'active').length;

	$: filteredVehicles = $vehicles.filter((v) => {
		const q = searchQuery.trim().toLowerCase();
		const matchesSearch =
			!q ||
			v.name?.toLowerCase().includes(q) ||
			v.driver?.toLowerCase().includes(q) ||
			v.model?.toLowerCase().includes(q) ||
			v.brand?.toLowerCase().includes(q) ||
			v.plate?.toLowerCase().includes(q);
		const matchesStatus =
			statusFilter === 'all' ||
			(statusFilter === 'active' ? v.status === 'active' : v.status !== 'active');
		return matchesSearch && matchesStatus;
	});

	$: allFilteredSelected =
		filteredVehicles.length > 0 && filteredVehicles.every((v) => $selectedVehicles.includes(v.id));

	onMount(async () => {
		if ($vehicles.length === 0) {
			await vehicleActions.loadVehicles();
		}
	});

	function toggleVehicleSelection(vehicleId) {
		vehicleActions.toggleVehicleSelection(vehicleId);
	}

	function toggleSelectAllFiltered() {
		if (allFilteredSelected) {
			const ids = new Set(filteredVehicles.map((v) => v.id));
			selectedVehicles.update((curr) => curr.filter((id) => !ids.has(id)));
		} else {
			const ids = filteredVehicles.map((v) => v.id);
			selectedVehicles.update((curr) => [...new Set([...curr, ...ids])]);
		}
	}

	async function refreshPositions() {
		await vehicleActions.loadVehiclePositions();
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

	function unitIconSrc(v) {
		const iconType = v.icon_type || v.iconType || 'vehicle-car-sedan';
		return unitIcons[iconType] || unitIcons['vehicle-car-sedan'];
	}

	function unitColorHex(v) {
		return colorSlugToHex(v.color) || v.profile_color_hex || '#94a3b8';
	}

	function unitTypeLabel(v) {
		const fromProfile = [v.brand, v.model].filter(Boolean).join(' ');
		if (fromProfile) return fromProfile;
		const t = v.icon_type || v.iconType || '';
		const labels = {
			'vehicle-car-sedan': 'Auto sedan',
			'vehicle-car-truck': 'Camioneta',
			'vehicle-backhoe-loader': 'Retroexcavadora',
			'vehicle-motorbike-sport': 'Motocicleta',
			'vehicle-trailer-dryvan': 'Remolque'
		};
		return labels[t] || 'Unidad';
	}

	function ignitionLabel(v) {
		return String(v?.engineStatus ?? '').toUpperCase() === 'ON' ? 'Encendida' : 'Apagada';
	}

	function ignitionOn(v) {
		return String(v?.engineStatus ?? '').toUpperCase() === 'ON';
	}

	function formatSpeed(v) {
		const spd = Number(v?.speed);
		if (Number.isNaN(spd)) return '—';
		return `${spd.toFixed(2)} km/h`;
	}

	function formatVoltage(val) {
		const n = Number(val);
		if (val == null || Number.isNaN(n)) return '—';
		return `${n.toFixed(1)}`;
	}

	function formatSignal(v) {
		const n = Number(v?.rxLvl);
		if (v?.rxLvl == null || Number.isNaN(n)) return '—';
		return `${n} dBm`;
	}
</script>

{#if !embedded}
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
{/if}

{#snippet vehicleListBody()}
	<div class="flex min-h-0 flex-1 flex-col gap-3">
		<div>
			<p class="m-0 text-[13px] text-slate-500 dark:text-slate-400">
				Visualiza y administra tus unidades en tiempo real
			</p>
		</div>

		<!-- Búsqueda -->
		<div
			class="flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 dark:border-white/10 dark:bg-white/[0.06]"
		>
			<Icon icon="mdi:magnify" width={16} class="shrink-0 text-slate-400 dark:text-white/40" />
			<input
				type="search"
				bind:value={searchQuery}
				placeholder="Buscar unidad, conductor..."
				class="min-w-0 flex-1 border-0 bg-transparent text-[14px] text-slate-900 outline-none placeholder:text-slate-400 dark:text-white dark:placeholder:text-white/35"
			/>
			{#if searchQuery}
				<button
					type="button"
					class="text-slate-400 dark:text-white/40"
					on:click={() => (searchQuery = '')}
					aria-label="Limpiar búsqueda"
				>
					<Icon icon="mdi:close-circle" width={16} />
				</button>
			{/if}
		</div>

		<!-- Filtros de estado (datos reales: activa / inactiva) -->
		<div class="flex flex-wrap gap-2" role="group" aria-label="Filtrar por estado">
			<button
				type="button"
				class="inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[12px] font-semibold transition-colors {statusFilter ===
				'all'
					? 'border-slate-700 bg-slate-800 text-white dark:border-slate-300 dark:bg-slate-200 dark:text-slate-900'
					: 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50 dark:border-white/10 dark:bg-white/[0.04] dark:text-slate-300'}"
				on:click={() => (statusFilter = 'all')}
				aria-pressed={statusFilter === 'all'}
			>
				Todas · {$vehicles.length}
			</button>
			<button
				type="button"
				class="inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[12px] font-semibold transition-colors {statusFilter ===
				'active'
					? 'border-emerald-600/40 bg-emerald-500/15 text-emerald-800 dark:border-emerald-400/40 dark:text-emerald-200'
					: 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50 dark:border-white/10 dark:bg-white/[0.04] dark:text-slate-300'}"
				on:click={() => (statusFilter = 'active')}
				aria-pressed={statusFilter === 'active'}
			>
				<span class="h-1.5 w-1.5 rounded-full bg-emerald-500" aria-hidden="true"></span>
				{activeCount} Activas
			</button>
			<button
				type="button"
				class="inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[12px] font-semibold transition-colors {statusFilter ===
				'inactive'
					? 'border-red-600/40 bg-red-500/15 text-red-800 dark:border-red-400/40 dark:text-red-200'
					: 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50 dark:border-white/10 dark:bg-white/[0.04] dark:text-slate-300'}"
				on:click={() => (statusFilter = 'inactive')}
				aria-pressed={statusFilter === 'inactive'}
			>
				<span class="h-1.5 w-1.5 rounded-full bg-red-500" aria-hidden="true"></span>
				{inactiveCount} Inactivas
			</button>
		</div>

		<!-- Cabecera selección -->
		<div class="flex items-center justify-between gap-2">
			<label
				class="flex cursor-pointer items-center gap-2 text-[12px] font-medium text-slate-600 dark:text-slate-300"
			>
				<input
					type="checkbox"
					class="size-3.5 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500 dark:border-slate-500"
					checked={allFilteredSelected}
					disabled={filteredVehicles.length === 0}
					on:change={toggleSelectAllFiltered}
				/>
				Seleccionar todas ({filteredVehicles.length})
			</label>
			<button
				type="button"
				class="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-[11px] font-semibold text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-800 disabled:opacity-50 dark:text-slate-400 dark:hover:bg-white/10 dark:hover:text-white"
				on:click={refreshPositions}
				disabled={$loadingPositions}
				aria-busy={$loadingPositions}
			>
				<Icon
					icon="mdi:refresh"
					class="h-3.5 w-3.5 {$loadingPositions ? 'animate-spin' : ''}"
					aria-hidden="true"
				/>
				Actualizar
			</button>
		</div>

		<!-- Lista de cards -->
		<div class="min-h-0 flex-1 overflow-y-auto overscroll-contain">
			{#if $loadingVehicles || ($loadingPositions && $vehicles.length === 0)}
				<div
					class="flex items-center justify-center gap-2 py-10"
					role="status"
					aria-live="polite"
					aria-busy="true"
				>
					<div
						class="h-6 w-6 shrink-0 animate-spin rounded-full border-2 border-slate-200 border-b-emerald-600 dark:border-slate-600 dark:border-b-emerald-400"
						aria-hidden="true"
					></div>
					<span class="text-sm text-slate-600 dark:text-slate-300">Cargando unidades…</span>
				</div>
			{:else if filteredVehicles.length === 0}
				<p class="py-10 text-center text-sm text-slate-500 dark:text-slate-400" role="status">
					{searchQuery || statusFilter !== 'all'
						? 'Sin resultados'
						: 'No hay vehículos disponibles'}
				</p>
			{:else}
				<ul class="m-0 flex list-none flex-col gap-2.5 p-0" aria-label="Lista de unidades">
					{#each filteredVehicles as vehicle (vehicle.id)}
						{@const coords = vehicleCoords(vehicle)}
						{@const isChecked = $selectedVehicles.includes(vehicle.id)}
						<li
							class="rounded-xl border border-slate-200 bg-white p-3 shadow-sm transition-colors dark:border-white/10 dark:bg-white/[0.04]"
						>
							<div class="flex items-start gap-2.5">
								<input
									id="vehicle-select-{vehicle.id}"
									type="checkbox"
									checked={isChecked}
									class="mt-1 size-3.5 shrink-0 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500 dark:border-slate-500"
									aria-label="Incluir {vehicle.name} en la selección"
									on:change={() => toggleVehicleSelection(vehicle.id)}
								/>

								<div class="flex h-9 w-9 shrink-0 items-center justify-center">
									<ColoredVehicleIcon
										src={unitIconSrc(vehicle)}
										colorHex={unitColorHex(vehicle)}
										sizeClass="h-8 w-8"
										alt=""
									/>
								</div>

								<div class="min-w-0 flex-1">
									<div class="flex items-start justify-between gap-2">
										<div class="min-w-0">
											<p class="m-0 truncate text-[14px] font-bold text-slate-900 dark:text-white">
												{vehicle.name}
											</p>
										</div>
										<span
											class="inline-flex shrink-0 items-center rounded-full px-2 py-0.5 text-[10px] font-semibold {getStatusPillClass(
												vehicle.status
											)}"
										>
											{vehicle.status === 'active'
												? 'Activa'
												: vehicle.status === 'inactive'
													? 'Inactiva'
													: getStatusText(vehicle.status)}
										</span>
									</div>

									<div
										class="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-slate-500 dark:text-slate-400"
									>
										<span class="inline-flex items-center gap-1">
											<Icon
												icon="mdi:account-outline"
												class="h-3.5 w-3.5 shrink-0"
												aria-hidden="true"
											/>
											{vehicle.driver || 'Sin conductor'}
										</span>
										<span class="inline-flex items-center gap-1">
											<Icon
												icon="mdi:map-marker-outline"
												class="h-3.5 w-3.5 shrink-0"
												aria-hidden="true"
											/>
											{unitTypeLabel(vehicle)}
										</span>
									</div>

									<div
										class="mt-2 grid grid-cols-3 gap-2 border-t border-slate-100 pt-2 dark:border-white/[0.06]"
									>
										<div>
											<p class="m-0 text-[10px] font-medium uppercase tracking-wide text-slate-400">
												Ignición
											</p>
											<p
												class="m-0 mt-0.5 inline-flex items-center gap-1 text-[12px] font-semibold text-slate-800 dark:text-slate-100"
											>
												<span
													class="h-1.5 w-1.5 rounded-full {ignitionOn(vehicle)
														? 'bg-emerald-500'
														: 'bg-slate-400'}"
													aria-hidden="true"
												></span>
												{ignitionLabel(vehicle)}
											</p>
										</div>
										<div>
											<p class="m-0 text-[10px] font-medium uppercase tracking-wide text-slate-400">
												Velocidad
											</p>
											<p
												class="m-0 mt-0.5 text-[12px] font-bold {getSpeedColor(
													Number(vehicle.speed) || 0
												)}"
											>
												{formatSpeed(vehicle)}
											</p>
										</div>
										<div>
											<p class="m-0 text-[10px] font-medium uppercase tracking-wide text-slate-400">
												Actualización
											</p>
											<p
												class="m-0 mt-0.5 truncate text-[11px] font-medium text-slate-700 dark:text-slate-200"
											>
												{vehicle.lastUpdateFormatted || '—'}
											</p>
										</div>
									</div>

									<div
										class="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-slate-500 dark:text-slate-400"
									>
										<span>
											<span class="font-semibold text-slate-700 dark:text-slate-200"
												>{formatVoltage(vehicle.mainBatteryVoltage)}</span
											>
											Vext
										</span>
										<span>
											<span class="font-semibold text-slate-700 dark:text-slate-200"
												>{formatVoltage(vehicle.backupBatteryVoltage)}</span
											>
											Vint
										</span>
										<span class="inline-flex items-center gap-1">
											<Icon icon="mdi:signal" class="h-3.5 w-3.5" aria-hidden="true" />
											<span class="font-semibold text-slate-700 dark:text-slate-200"
												>{formatSignal(vehicle)}</span
											>
											Señal
										</span>
									</div>
								</div>

								<button
									type="button"
									class="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-emerald-600 text-white shadow-sm transition-colors hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-40"
									on:click={() => centerOnVehicle(vehicle)}
									disabled={!coords}
									aria-label="Centrar el mapa en {vehicle.name}"
									title="Centrar en mapa"
								>
									<Icon icon="mdi:crosshairs-gps" class="h-4 w-4" aria-hidden="true" />
								</button>
							</div>
						</li>
					{/each}
				</ul>
			{/if}
		</div>

		<!-- Pie: conteo + acciones selección -->
		<div class="flex shrink-0 flex-col gap-2 border-t border-slate-200 pt-3 dark:border-white/10">
			<p class="m-0 text-[11px] text-slate-500 dark:text-slate-400">
				Mostrando {filteredVehicles.length === 0 ? 0 : 1} a {filteredVehicles.length} de
				{$vehicles.length} unidades
			</p>
			{#if $selectedVehicleCount > 0}
				<button
					type="button"
					class="w-full rounded-lg border border-emerald-600/25 bg-emerald-600 px-3 py-2.5 text-xs font-semibold text-white shadow-sm transition-colors hover:bg-emerald-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-500"
					on:click={trackSelectedVehicles}
				>
					Rastrear seleccionados ({$selectedVehicleCount})
				</button>
			{/if}
		</div>
	</div>
{/snippet}

{#if embedded}
	<div class="flex h-full min-h-0 flex-col">
		<h2 class="m-0 mb-1 text-lg font-bold text-slate-900 dark:text-white">Seguimiento</h2>
		{@render vehicleListBody()}
	</div>
{:else}
	<CenterSheet open={showVehiclePanel} title="Seguimiento" onClose={() => onClose()}>
		{@render vehicleListBody()}
	</CenterSheet>
{/if}
