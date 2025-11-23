<script>
	import { onMount } from 'svelte';
	import { apiService } from '$lib/services/api.js';
	import { positionService } from '$lib/services/positionService.js';
	import { vehicleActions } from '$lib/stores/vehicleStore.js';

	export let showVehiclePanel = false;
	export let toggleVehiclePanel = null;
	export let embedded = false;

	let units = [];
	let loading = false;
	let error = null;

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
		const deviceId = unit.device_id || unit.deviceId;
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
								<h3 class="font-bold text-app text-lg tracking-wide">{unit.name}</h3>
							</div>
						</div>
					{/each}
				</div>
			{/if}
		</div>
	</div>
{/if}

<style>
	.unit-card {
		box-shadow: 0 2px 5px rgba(0, 0, 0, 0.1);
	}
</style>
