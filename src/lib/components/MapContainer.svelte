<script>
	import { onMount } from 'svelte';
	import { mapService } from '$lib/services/mapService.js';
	import { vehicles, vehicleActions } from '$lib/stores/vehicleStore.js';

	export let isLoading = true;

	let mapElement;
	let map;

	onMount(async () => {
		try {
			map = await mapService.initialize(mapElement);
			isLoading = false;

			// Suscribirse a cambios en vehículos para actualizar marcadores
			const unsubscribe = vehicles.subscribe((vehicleList) => {
				if (vehicleList.length > 0) {
					// Limpiar marcadores existentes (excepto ubicación del usuario)
					mapService.markers.forEach((markerData, key) => {
						if (key !== 'user-location') {
							markerData.marker.setMap(null);
							mapService.markers.delete(key);
						}
					});

					// Agregar nuevos marcadores
					mapService.addVehicleMarkers(vehicleList);

					// Centrar en vehículos con coordenadas válidas
					const vehiclesWithCoords = vehicleList.filter(
						(v) => (v.latitude || v.lat) && (v.longitude || v.lng)
					);

					if (vehiclesWithCoords.length > 0) {
						mapService.centerOnVehicles(vehiclesWithCoords);
					}
				}
			});

			return () => {
				unsubscribe();
			};
		} catch (error) {
			console.error('Error inicializando mapa:', error);
			isLoading = false;
		}
	});
</script>

<!-- Contenedor del mapa -->
<div class="map-wrap">
	{#if isLoading}
		<div class="flex items-center justify-center h-full loading-overlay">
			<div class="text-center">
				<div
					class="animate-spin rounded-full h-12 w-12 border-b-2 mx-auto mb-4"
					style="border-color: var(--accent-cyan)"
				></div>
				<p class="font-medium text-app">Cargando mapa...</p>
			</div>
		</div>
	{/if}

	<div bind:this={mapElement} class="map-canvas"></div>
	<div class="vignette pointer-events-none"></div>
</div>

<style>
	.map-wrap {
		position: relative;
		width: 100%;
		height: 100vh; /* ajusta según tu layout */
		background: #0b1524; /* fondo fuera del mapa */
		border-radius: 16px;
		overflow: hidden; /* recorta el canvas + overlay */
	}

	.map-canvas {
		position: absolute;
		inset: 0;
	}

	.vignette {
		position: absolute;
		inset: 0;
		pointer-events: none;
	}

	@supports (mask-image: radial-gradient(circle, #000, transparent)) {
		.vignette {
			background-color: rgba(11, 21, 36, 0.65);
			mask-image: radial-gradient(circle at 50% 50%, transparent 60%, black 85%);
			-webkit-mask-image: radial-gradient(circle at 50% 50%, transparent 60%, black 85%);
		}
	}

	@supports not (mask-image: radial-gradient(circle, #000, transparent)) {
		.vignette {
			background: radial-gradient(
				circle at 50% 50%,
				rgba(11, 21, 36, 0) 58%,
				rgba(11, 21, 36, 0.5) 80%,
				rgba(11, 21, 36, 0.7) 100%
			);
		}
	}
</style>
