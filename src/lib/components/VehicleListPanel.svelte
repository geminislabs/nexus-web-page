<!-- src/lib/components/VehicleListPanel.svelte -->
<script>
	import Icon from '@iconify/svelte';
	import { onMount } from 'svelte';
	import {
		vehicles,
		loadingVehicles,
		loadingPositions,
		activeVehicles,
		vehicleActions
	} from '$lib/stores/vehicleStore.js';
	import { mapService } from '$lib/services/mapService.js';
	import { requestedPanelView } from '$lib/stores/navigationStore.js';

	let collapsed = false;
	let expandedId = null; // id de la unidad con perfil expandido

	onMount(async () => {
		if ($vehicles.length === 0) {
			await vehicleActions.loadVehicles();
		}
	});

	function selectVehicle(v) {
		vehicleActions.setActiveUnit(v.id);
		mapService.centerOnVehicle(v);
	}

	function toggleExpand(v, e) {
		e.stopPropagation();
		expandedId = expandedId === v.id ? null : v.id;
	}

	function goToTrips(v, e) {
		e.stopPropagation();
		vehicleActions.setActiveUnit(v.id);
		mapService.centerOnVehicle(v);
		requestedPanelView.set('trips');
	}

	function vehicleHasCoords(v) {
		const lat = v?.latitude ?? v?.lat;
		const lng = v?.longitude ?? v?.lng;
		return lat != null && lng != null && !Number.isNaN(Number(lat)) && !Number.isNaN(Number(lng));
	}

	function getStatusDot(v) {
		const spd = Number(v?.speed);
		const moving = !Number.isNaN(spd) && spd > 3;
		const engineOn = v?.engineStatus?.toUpperCase() === 'ON' || v?.isOnline === true;
		const hasSignal = v?.lastUpdate != null || v?.gpsDatetime != null;
		if (moving || engineOn) return 'bg-emerald-400';
		if (!hasSignal) return 'bg-red-400';
		return 'bg-amber-400';
	}

	function getStatusLabel(v) {
		const spd = Number(v?.speed);
		const moving = !Number.isNaN(spd) && spd > 3;
		const engineOn = v?.engineStatus?.toUpperCase() === 'ON' || v?.isOnline === true;
		const hasSignal = v?.lastUpdate != null || v?.gpsDatetime != null;
		if (moving) return `${Math.round(spd)} km/h`;
		if (engineOn) return 'Online';
		if (!hasSignal) return 'Sin señal';
		return 'Detenido';
	}

	function getStatusColor(v) {
		const spd = Number(v?.speed);
		const moving = !Number.isNaN(spd) && spd > 3;
		const engineOn = v?.engineStatus?.toUpperCase() === 'ON' || v?.isOnline === true;
		const hasSignal = v?.lastUpdate != null || v?.gpsDatetime != null;
		if (moving || engineOn) return 'text-emerald-400';
		if (!hasSignal) return 'text-red-400';
		return 'text-amber-400';
	}

	// GPS fix — usa fixStatus si disponible, sino inferencia
	function hasValidGpsFix(v) {
		const fixRaw = v?.fixStatus ?? v?.fix_status ?? v?.fix;
		if (fixRaw != null) return String(fixRaw).toUpperCase() === 'VALID';
		return vehicleHasCoords(v) && (v?.lastUpdate != null || v?.gpsDatetime != null);
	}

	function profileDetail(v) {
		return [v.brand, v.model, v.color, v.plate].filter(Boolean).join(' / ') || null;
	}

	$: activeCount = $activeVehicles?.length ?? 0;
</script>

<div
	class="pointer-events-auto w-[300px] overflow-hidden rounded-2xl bg-[#0c1829] shadow-[0_-4px_20px_rgba(0,0,0,0.5)]"
>
	<!-- Header -->
	<div class="flex items-center gap-2.5 border-b border-white/[0.08] px-4 py-3">
		<span class="h-2 w-2 shrink-0 animate-pulse rounded-full bg-emerald-400" aria-hidden="true"
		></span>
		<p class="m-0 flex-1 text-xs font-semibold uppercase tracking-widest text-white/55">
			Unidades
			<span class="ml-1 font-bold text-emerald-400">{activeCount}</span><span class="text-white/30"
				>/{$vehicles.length}</span
			>
		</p>
		<button
			type="button"
			class="flex h-7 w-7 items-center justify-center rounded-lg text-white/35 transition-colors hover:bg-white/[0.06] hover:text-white/65"
			on:click={() => (collapsed = !collapsed)}
			aria-label={collapsed ? 'Expandir lista de unidades' : 'Colapsar lista de unidades'}
			aria-expanded={!collapsed}
		>
			<Icon icon={collapsed ? 'mdi:chevron-up' : 'mdi:chevron-down'} class="h-4 w-4" />
		</button>
	</div>

	{#if !collapsed}
		<!-- Lista -->
		<div class="max-h-[400px] overflow-y-auto overscroll-contain">
			{#if $loadingVehicles}
				<div class="flex h-20 items-center justify-center gap-2">
					<div
						class="h-5 w-5 animate-spin rounded-full border-2 border-white/10 border-t-sky-400"
						aria-hidden="true"
					></div>
					<span class="text-xs text-white/40">Cargando…</span>
				</div>
			{:else if $vehicles.length === 0}
				<p class="py-8 text-center text-xs text-white/30" role="status">
					No hay unidades disponibles
				</p>
			{:else}
				<ul class="m-0 list-none space-y-0.5 p-2" aria-label="Lista de unidades">
					{#each $vehicles as v (v.id)}
						{@const hasCoords = vehicleHasCoords(v)}
						{@const validFix = hasValidGpsFix(v)}
						{@const isExpanded = expandedId === v.id}
						<li class="overflow-hidden rounded-xl {isExpanded ? 'bg-white/[0.04]' : ''}">
							<!-- Fila principal -->
							<div class="flex items-center gap-2">
								<!-- Icono / expand toggle -->
								<button
									type="button"
									class="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-white/50 transition-colors hover:bg-white/[0.08] hover:text-white/80 focus-visible:outline focus-visible:ring-2 focus-visible:ring-sky-400/40"
									on:click={(e) => toggleExpand(v, e)}
									aria-label="{isExpanded ? 'Ocultar' : 'Ver'} perfil de {v.name}"
									aria-expanded={isExpanded}
								>
									<Icon icon={isExpanded ? 'mdi:chevron-up' : 'mdi:car-side'} class="h-5 w-5" />
								</button>
								<!-- Nombre + estado -->
								<button
									type="button"
									class="flex min-w-0 flex-1 items-center gap-2 py-2.5 text-left transition-colors hover:text-white focus-visible:outline focus-visible:ring-2 focus-visible:ring-sky-400/40 disabled:cursor-not-allowed disabled:opacity-40"
									disabled={!hasCoords}
									on:click={() => selectVehicle(v)}
									aria-label="Ver {v.name} en el mapa"
								>
									<div
										class="h-2.5 w-2.5 shrink-0 rounded-full {getStatusDot(v)}"
										aria-hidden="true"
									></div>
									<div class="min-w-0 flex-1">
										<p class="m-0 truncate text-[13px] font-semibold text-white">{v.name}</p>
										<p class="m-0 mt-0.5 text-[11px] text-white/40">
											{v.driver || 'Sin conductor'}
										</p>
									</div>
								</button>
								<!-- GPS fix badge + status -->
								<div class="flex shrink-0 items-center gap-1.5 pr-2">
									<span
										class="rounded-md px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide {validFix
											? 'bg-emerald-500/20 text-emerald-400'
											: 'bg-red-500/20 text-red-400'}"
										title="GPS fix {validFix ? 'VALID' : 'INVALID'}"
									>
										{validFix ? 'FIX' : 'NO FIX'}
									</span>
									<span class="text-[11px] font-semibold {getStatusColor(v)}">
										{getStatusLabel(v)}
									</span>
								</div>
							</div>

							<!-- Perfil expandido -->
							{#if isExpanded}
								<div class="border-t border-white/[0.06] px-3 pb-3 pt-2.5">
									<!-- Sección: Información general -->
									<p
										class="m-0 mb-1.5 text-[9px] font-bold uppercase tracking-widest text-cyan-400/70"
									>
										General
									</p>
									<dl class="m-0 space-y-1">
										<div class="flex items-baseline justify-between gap-2">
											<dt class="text-[11px] text-white/40">Nombre</dt>
											<dd class="m-0 truncate text-[11px] font-medium text-white">{v.name}</dd>
										</div>
										{#if v.description}
											<div class="flex items-baseline justify-between gap-2">
												<dt class="text-[11px] text-white/40">Descripción</dt>
												<dd class="m-0 truncate text-[11px] font-medium text-white">
													{v.description}
												</dd>
											</div>
										{/if}
									</dl>

									<!-- Sección: Vehículo -->
									{#if v.brand || v.model || v.year || v.color || v.plate || v.vin}
										<p
											class="m-0 mb-1.5 mt-2.5 text-[9px] font-bold uppercase tracking-widest text-cyan-400/70"
										>
											Vehículo
										</p>
										<dl class="m-0 space-y-1">
											{#if v.brand || v.model}
												<div class="flex items-baseline justify-between gap-2">
													<dt class="text-[11px] text-white/40">Marca / Modelo</dt>
													<dd class="m-0 truncate text-[11px] font-medium text-white">
														{[v.brand, v.model].filter(Boolean).join(' ') || '—'}
													</dd>
												</div>
											{/if}
											{#if v.year}
												<div class="flex items-baseline justify-between gap-2">
													<dt class="text-[11px] text-white/40">Año</dt>
													<dd class="m-0 text-[11px] font-medium text-white">{v.year}</dd>
												</div>
											{/if}
											{#if v.color}
												<div class="flex items-baseline justify-between gap-2">
													<dt class="text-[11px] text-white/40">Color</dt>
													<dd class="m-0 text-[11px] font-medium capitalize text-white">
														{v.color}
													</dd>
												</div>
											{/if}
											{#if v.plate}
												<div class="flex items-baseline justify-between gap-2">
													<dt class="text-[11px] text-white/40">Placa</dt>
													<dd class="m-0 text-[11px] font-medium uppercase text-white">
														{v.plate}
													</dd>
												</div>
											{/if}
											{#if v.vin}
												<div class="flex items-baseline justify-between gap-2">
													<dt class="text-[11px] text-white/40">VIN</dt>
													<dd class="m-0 truncate font-mono text-[10px] text-white/70">{v.vin}</dd>
												</div>
											{/if}
										</dl>
									{/if}

									<!-- Sección: Dispositivo -->
									<p
										class="m-0 mb-1.5 mt-2.5 text-[9px] font-bold uppercase tracking-widest text-cyan-400/70"
									>
										Dispositivo
									</p>
									<dl class="m-0">
										<div class="flex items-baseline justify-between gap-2">
											<dt class="text-[11px] text-white/40">Device ID</dt>
											<dd class="m-0 truncate font-mono text-[10px] text-white/70">
												{v.deviceId || 'Sin asignar'}
											</dd>
										</div>
									</dl>

									<!-- Botón Trayectos -->
									<button
										type="button"
										class="mt-3 flex w-full items-center justify-center gap-1.5 rounded-xl bg-gradient-to-r from-indigo-600 to-blue-600 py-2 text-[12px] font-semibold text-white shadow-md transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
										disabled={!hasCoords}
										on:click={(e) => goToTrips(v, e)}
									>
										<Icon icon="mdi:source-branch" class="h-4 w-4" />
										Trayectos
									</button>
								</div>
							{/if}
						</li>
					{/each}
				</ul>
			{/if}
		</div>

		<!-- Footer -->
		<div class="border-t border-white/[0.07] px-3 py-2">
			<button
				type="button"
				class="flex w-full items-center justify-center gap-1.5 rounded-lg bg-white/[0.04] px-3 py-2 text-[11px] font-medium text-white/40 transition-colors hover:bg-white/[0.07] hover:text-white/65 disabled:opacity-50"
				on:click={() => vehicleActions.loadVehiclePositions()}
				disabled={$loadingPositions}
				aria-busy={$loadingPositions}
			>
				<Icon
					icon="mdi:refresh"
					class="h-3.5 w-3.5 {$loadingPositions ? 'animate-spin' : ''}"
					aria-hidden="true"
				/>
				{$loadingPositions ? 'Actualizando…' : 'Actualizar posiciones'}
			</button>
		</div>
	{/if}
</div>
