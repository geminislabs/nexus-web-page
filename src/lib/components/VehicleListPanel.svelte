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

	let collapsed = false;

	onMount(async () => {
		if ($vehicles.length === 0) {
			await vehicleActions.loadVehicles();
		}
	});

	function selectVehicle(v) {
		vehicleActions.setActiveUnit(v.id);
		mapService.centerOnVehicle(v);
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
		<div class="max-h-[300px] overflow-y-auto overscroll-contain">
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
						<li>
							<button
								type="button"
								class="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-colors hover:bg-white/[0.06] focus-visible:outline focus-visible:ring-2 focus-visible:ring-sky-400/40 disabled:cursor-not-allowed disabled:opacity-40"
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
								<span class="shrink-0 text-[11px] font-semibold {getStatusColor(v)}">
									{getStatusLabel(v)}
								</span>
							</button>
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
