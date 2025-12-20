<script>
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { user } from '$lib/stores/auth.js';
	import {
		vehicleActions,
		loadingVehicles,
		loadingPositions,
		vehicles
	} from '$lib/stores/vehicleStore.js';
	import { apiService } from '$lib/services/api.js';
	import { positionService } from '$lib/services/positionService.js';
	import { mapService } from '$lib/services/mapService.js';
	import { fade } from 'svelte/transition';
	import Sidebar from '$lib/components/Sidebar.svelte';
	import MapContainer from '$lib/components/MapContainer.svelte';

	let isLoading = true;
	let userData = null;
	let showToast = false;
	let toastTimeout;

	$: {
		if ($loadingVehicles || $loadingPositions) {
			showToast = true;
			if (toastTimeout) clearTimeout(toastTimeout);
		} else {
			if (showToast) {
				toastTimeout = setTimeout(() => (showToast = false), 600);
			}
		}
	}

	let loadedOnce = false;
	let realtimeConnection = null;
	let reconnectAttempts = 0;
	let maxReconnectAttempts = 5;
	let reconnectDelay = 5000; // 5 segundos

	function normalizeCommToVehicle(c) {
		const deviceId = c?.device_id || c?.deviceId || c?.device?.id || c?.id || 'unknown';
		const lat = c?.latitude ?? c?.lat ?? c?.coordinates?.lat ?? c?.position?.lat;
		const lng = c?.longitude ?? c?.lng ?? c?.coordinates?.lng ?? c?.position?.lng;

		return {
			id: deviceId,
			deviceId,
			latitude: lat,
			longitude: lng,
			status: 'active',
			// Todos los campos de communications
			backup_battery_voltage: c.backup_battery_voltage,
			course: c.course,
			delivery_type: c.delivery_type,
			heading: c.heading ?? c.course,
			engine_status: c.engine_status,
			fix_status: c.fix_status,
			gps_datetime: c.gps_datetime,
			gps_epoch: c.gps_epoch,
			main_battery_voltage: c.main_battery_voltage,
			msg_class: c.msg_class,
			network_status: c.network_status,
			odometer: c.odometer,
			received_at: c.received_at,
			received_epoch: c.received_epoch,
			rx_lvl: c.rx_lvl,
			satellites: c.satellites,
			satellites: c.satellites,
			speed: c.speed,
			alert: c.alert
		};
	}

	async function waitForMapReady(maxAttempts = 20, delayMs = 150) {
		let attempts = 0;
		while (!mapService?.isReady && attempts < maxAttempts) {
			await new Promise((r) => setTimeout(r, delayMs));
			attempts++;
		}
		return !!mapService?.isReady;
	}

	async function loadDevicesAndCommunications() {
		try {
			// Load devices and units in parallel
			const [devicesData, unitsData] = await Promise.all([
				apiService.getMyDevices(),
				apiService.getUnits()
			]);

			// Determine device list; API may return an array or an object with a .devices property
			let deviceList;
			if (Array.isArray(devicesData)) {
				deviceList = devicesData;
			} else {
				deviceList = devicesData?.devices || [];
			}

			console.log('devicesData', devicesData);
			console.log('deviceList', deviceList);
			console.log('unitsData', unitsData);

			// Create a map of units by device_id for quick lookup
			const unitsByDeviceId = {};
			const unitsList = Array.isArray(unitsData) ? unitsData : unitsData?.units || [];
			unitsList.forEach((unit) => {
				if (unit.device_id) {
					unitsByDeviceId[unit.device_id] = unit;
				}
			});

			// Get device ids for fetching communications
			const ids = deviceList.map((d) => d.device_id);
			console.log('ids', ids);

			// Get latest communications
			let communicationsByDeviceId = {};
			if (ids.length > 0) {
				try {
					const comm = await positionService.getLatestCommunications(ids);
					console.log('Communications (page load):', comm);

					const items = Array.isArray(comm) ? comm : comm?.communications || [];
					items.forEach((c) => {
						const deviceId = c?.device_id || c?.deviceId || c?.device?.id;
						if (deviceId) {
							communicationsByDeviceId[deviceId] = c;
						}
					});
				} catch (e2) {
					console.warn('Failed to get communications on page load:', e2);
				}
			}

			// Combine all data: devices + units + communications
			const mapped = deviceList.map((d) => {
				const deviceId = d.device_id;
				const unit = unitsByDeviceId[deviceId] || {};
				const comm = communicationsByDeviceId[deviceId] || {};

				return {
					id: deviceId,
					name: unit.name || deviceId,
					unit_id: unit.id, // Ensure unit.id is mapped for profile fetching
					deviceId: deviceId,
					status: 'active',
					icon_type: d.icon_type, // Map icon_type from device data
					// Datos de communications
					backup_battery_voltage: comm.backup_battery_voltage,
					course: comm.course,
					delivery_type: comm.delivery_type,
					engine_status: comm.engine_status,
					fix_status: comm.fix_status,
					gps_datetime: comm.gps_datetime,
					gps_epoch: comm.gps_epoch,
					latitude: comm.latitude,
					longitude: comm.longitude,
					main_battery_voltage: comm.main_battery_voltage,
					msg_class: comm.msg_class,
					network_status: comm.network_status,
					odometer: comm.odometer,
					received_at: comm.received_at,
					received_epoch: comm.received_epoch,
					rx_lvl: comm.rx_lvl,
					satellites: comm.satellites,
					speed: comm.speed
				};
			});

			vehicles.set(mapped);

			// Load profiles (color, icon_type) in background
			vehicleActions.loadVehicleProfiles();

			// Update map markers after setting vehicles
			if (ids.length > 0) {
				await waitForMapReady();
				// Clear existing markers before adding new ones
				mapService.clearAllMarkers();

				mapped.forEach((vehicle) => {
					if (vehicle.latitude != null && vehicle.longitude != null) {
						mapService.updateVehicleMarker(vehicle);
					}
				});

				// Start realtime connection after initial positions loaded
				startRealtimeConnection(ids);
			}
		} catch (e) {
			console.error('Error loading devices on page load:', e);
		}
	}

	function startRealtimeConnection(deviceIds) {
		// Cerrar conexión existente si la hay
		if (realtimeConnection) {
			realtimeConnection.close();
			realtimeConnection = null;
		}

		// Resetear contador de reintentos si se inicia una nueva conexión
		if (reconnectAttempts > 0) {
			console.warn(`Reconnecting... Attempt ${reconnectAttempts + 1}/${maxReconnectAttempts}`);
		}

		console.warn('Starting real-time connection for devices:', deviceIds);

		try {
			realtimeConnection = positionService.connectToRealtimeStream(
				deviceIds,
				// onUpdate callback
				(data) => {
					console.warn('Real-time update received:', data);

					// Resetear contador de reintentos en conexión exitosa
					reconnectAttempts = 0;

					// Normalizar los datos del vehículo
					const vehicleData = normalizeCommToVehicle(data);

					// Verificar que tenemos coordenadas válidas
					if (vehicleData.latitude != null && vehicleData.longitude != null) {
						// Actualizar el marcador en el mapa
						mapService.updateVehicleMarker(vehicleData);

						// Actualizar el vehículo en el store con todos los campos
						vehicleActions.updateVehicle(vehicleData.deviceId, vehicleData);

						// Actualizar el indicador de carga
						loadingPositions.set(false);
					}
				},
				// onError callback
				(error) => {
					console.error('Real-time connection error:', error);

					// Implementar lógica de reconexión con backoff exponencial
					if (reconnectAttempts < maxReconnectAttempts) {
						reconnectAttempts++;
						const delay = reconnectDelay * Math.pow(2, reconnectAttempts - 1); // Backoff exponencial

						console.warn(
							`Real-time connection lost. Retrying in ${delay / 1000} seconds... (Attempt ${reconnectAttempts}/${maxReconnectAttempts})`
						);

						setTimeout(() => {
							startRealtimeConnection(deviceIds);
						}, delay);
					} else {
						console.error('Max reconnection attempts reached. Real-time updates disabled.');
						// Aquí podrías mostrar un mensaje al usuario o intentar reconectar manualmente
					}
				}
			);
		} catch (error) {
			console.error('Error starting real-time connection:', error);

			// Intentar reconectar incluso si falla la creación inicial
			if (reconnectAttempts < maxReconnectAttempts) {
				reconnectAttempts++;
				setTimeout(() => {
					startRealtimeConnection(deviceIds);
				}, reconnectDelay);
			}
		}
	}

	onMount(async () => {
		await user.init();
		const unsubscribe = user.subscribe((data) => {
			userData = data;
			if (!data) {
				goto('/login');
				return;
			}
		});
		loadDevicesAndCommunications();

		// Cleanup function
		return () => {
			unsubscribe();
			if (realtimeConnection) {
				realtimeConnection.close();
				realtimeConnection = null;
			}
		};
	});
</script>

<div class="h-screen w-screen relative overflow-hidden bg-app">
	<Sidebar {userData} />

	<!-- Contenedor del mapa -->
	<MapContainer bind:isLoading />

	{#if showToast}
		<div class="fixed bottom-4 right-4 z-50" transition:fade={{ duration: 200 }}>
			<div class="flex items-center gap-3 px-4 py-3 rounded-lg shadow-lg toast-card">
				<svg
					class="animate-spin h-5 w-5"
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
				<span class="text-sm font-medium text-app"
					>{$loadingVehicles || $loadingPositions
						? $loadingVehicles
							? 'Cargando vehículos…'
							: 'Actualizando posiciones…'
						: 'Listo'}</span
				>
			</div>
		</div>
	{/if}
</div>
