<script>
	import { onMount, onDestroy } from 'svelte';
	import { page } from '$app/stores';
	import { positionService } from '$lib/services/positionService.js';
	import { vehicles, vehicleActions } from '$lib/stores/vehicleStore.js';
	import MapContainer from '$lib/components/MapContainer.svelte';

	let token = $page.params.token;
	let loading = true;
	let error = null;
	let success = false;
	let streamConnection = null;

	function normalizeResponseToVehicle(data) {
		// Adaptar la respuesta del endpoint share-location a la estructura de vehículo
		const comm = data.last_communication || {};

		return {
			id: data.device_id || comm.device_id || 'unknown',
			deviceId: data.device_id || comm.device_id || 'unknown',
			name: data.name || data.alias || 'Unidad Compartida',
			latitude: comm.latitude || data.latitude || data.lat,
			longitude: comm.longitude || data.longitude || data.lng,
			status: 'active',
			icon_type: data.icon_type || 'vehicle-car-sedan',

			// Campos de last_communication
			speed: comm.speed || data.speed || 0,
			course: comm.course || data.course || 0,
			gps_datetime: comm.gps_datetime || data.gps_datetime,
			engine_status: comm.engine_status,
			fix_status: comm.fix_status,
			satellites: comm.satellites,

			// Otros datos
			expires_at: data.expires_at,
			...comm,
			...data
		};
	}

	function handleStreamUpdate(data) {
		// Actualizar el store de vehículos
		// Asumimos que data trae { device_id, latitude, longitude, ... }

		// Buscar el vehículo actual en el store para mantener propiedades estáticas (nombre, icono)
		let currentVehicle = null;
		vehicles.subscribe((list) => {
			if (list.length > 0) currentVehicle = list[0];
		})();

		if (
			currentVehicle &&
			(data.device_id === currentVehicle.deviceId || data.device_id === currentVehicle.id)
		) {
			const updatedVehicle = {
				...currentVehicle,
				latitude: data.latitude,
				longitude: data.longitude,
				speed: data.speed,
				course: data.course,
				gps_datetime: data.gps_datetime
				// Actualizar otros campos si vienen en el stream
			};

			vehicles.set([updatedVehicle]);
		}
	}

	onMount(async () => {
		try {
			// Limpiar vehículos anteriores
			vehicles.set([]);

			const response = await positionService.initShareLocation(token);

			if (response) {
				const vehicle = normalizeResponseToVehicle(response);

				// Actualizar store
				if (vehicle.latitude && vehicle.longitude) {
					vehicles.set([vehicle]);
					success = true;
				} else {
					// Si no hay coordenadas, tal vez solo mostrar el mapa vacío o error?
					// El usuario dijo "mostrar el mapa", así que lo mostramos aunque no haya ubicación (se verá el mundo)
					// Pero idealmente debería haber ubicación.
					console.warn('No coordinates in share response');
					vehicles.set([vehicle]); // Set anyway so it appears in list if we had one, but map won't center
					success = true;
				}

				// Iniciar stream
				streamConnection = positionService.connectToShareStream(
					token,
					handleStreamUpdate,
					(err) => {
						console.error('Stream error:', err);
						// Mostrar error si es crítico
						if (err) {
							// Si ya tenemos éxito (mapa cargado), tal vez solo mostrar un toast o alerta no intrusiva?
							// Por ahora, si el error es de conexión inicial o expiración, mostramos la pantalla de error.
							if (
								!success ||
								(err.message &&
									(err.message.includes('failed') || err.message.includes('expirado')))
							) {
								error = err;
								success = false;
								if (streamConnection) streamConnection.close();
							}
						}
					}
				);
			} else {
				throw new Error('Respuesta vacía del servidor');
			}
		} catch (e) {
			console.error('Share location error:', e);
			error = e;
		} finally {
			loading = false;
		}
	});

	onDestroy(() => {
		if (streamConnection) {
			streamConnection.close();
		}
	});
</script>

<div class="h-screen w-screen relative overflow-hidden bg-app">
	{#if loading}
		<div class="flex items-center justify-center h-full">
			<div class="text-center">
				<div
					class="animate-spin rounded-full h-12 w-12 border-b-2 mx-auto mb-4"
					style="border-color: var(--accent-cyan)"
				></div>
				<p class="font-medium text-app text-white">Verificando enlace...</p>
			</div>
		</div>
	{:else if error}
		<div class="flex flex-col items-center justify-center h-full p-6 text-center">
			<div class="bg-gray-900 p-8 rounded-xl shadow-2xl border border-gray-800 max-w-md w-full">
				<div class="mb-6 text-red-500">
					<svg
						xmlns="http://www.w3.org/2000/svg"
						class="h-16 w-16 mx-auto"
						fill="none"
						viewBox="0 0 24 24"
						stroke="currentColor"
					>
						<path
							stroke-linecap="round"
							stroke-linejoin="round"
							stroke-width="2"
							d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
						/>
					</svg>
				</div>
				<h1 class="text-2xl font-bold text-white mb-2">Enlace no válido</h1>
				<p class="text-gray-400 mb-6">No se pudo acceder a la ubicación compartida.</p>

				{#if error.detail || error.message}
					<div class="bg-black/50 p-4 rounded-lg text-left overflow-hidden">
						<p class="text-xs text-gray-500 uppercase mb-1">Detalle del error</p>
						<code class="text-sm text-red-400 font-mono break-all">
							{error.detail || error.message}
						</code>
					</div>
				{/if}
			</div>
		</div>
	{:else if success}
		<MapContainer bind:isLoading={loading} />
	{/if}
</div>

<style>
	:global(body) {
		background-color: #0f172a; /* Fallback dark color matching bg-app usually */
		margin: 0;
	}
	.bg-app {
		background-color: var(--bg-app, #0f172a);
	}
	.text-app {
		color: var(--text-primary, #ffffff);
	}
</style>
