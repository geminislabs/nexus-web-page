import { writable, derived, get } from 'svelte/store';
import { apiService } from '$lib/services/api.js';
import { positionService } from '$lib/services/positionService.js';

// Estado principal de vehículos
export const vehicles = writable([]);
export const selectedVehicles = writable([]);
export const loadingVehicles = writable(false);
export const vehiclePositions = writable(new Map());
export const loadingPositions = writable(false);

// Configuración de vehículos con sus deviceIds
const VEHICLE_CONFIG = [
	{
		id: 'VH001',
		name: 'Unidad Principal',
		driver: 'Conductor Asignado',
		deviceId: '0848086072', // Tu deviceId real
		status: 'active',
		location: 'En ruta'
	}
];

// Datos de ejemplo para fallback (sin el deviceId real)
const EXAMPLE_VEHICLES = [
	{
		id: 'VH001',
		name: 'Unidad 01 — Sedán',
		driver: 'Carlos Mendoza',
		deviceId: '0848086001',
		status: 'active',
		location: 'Centro Histórico',
		latitude: 20.5888,
		longitude: -100.3899,
		speed: 47,
		battery: 78,
		fuel: 78,
		lastUpdate: new Date(Date.now() - 2 * 60000).toISOString(),
		lastUpdateFormatted: 'Hace 2 minutos',
		coordinates: { lat: 20.5888, lng: -100.3899 }
	},
	{
		id: 'VH002',
		name: 'Unidad 02 — Pickup',
		driver: 'María González',
		deviceId: '0848086002',
		status: 'active',
		location: 'Juriquilla',
		latitude: 20.7079,
		longitude: -100.4405,
		speed: 0,
		battery: 92,
		fuel: 92,
		lastUpdate: new Date(Date.now() - 5 * 60000).toISOString(),
		lastUpdateFormatted: 'Hace 5 minutos',
		coordinates: { lat: 20.7079, lng: -100.4405 }
	},
	{
		id: 'VH003',
		name: 'Unidad 03 — Van',
		driver: 'Roberto Sánchez',
		deviceId: '0848086003',
		status: 'active',
		location: 'Cimatario',
		latitude: 20.552,
		longitude: -100.354,
		speed: 32,
		battery: 55,
		fuel: 55,
		lastUpdate: new Date(Date.now() - 1 * 60000).toISOString(),
		lastUpdateFormatted: 'Hace 1 minuto',
		coordinates: { lat: 20.552, lng: -100.354 }
	},
	{
		id: 'VH004',
		name: 'Unidad 04 — Camión',
		driver: 'Ana López',
		deviceId: '0848086004',
		status: 'inactive',
		location: 'Peñuelas',
		latitude: 20.542,
		longitude: -100.318,
		speed: 0,
		battery: 12,
		fuel: 15,
		lastUpdate: new Date(Date.now() - 3 * 60 * 60000).toISOString(),
		lastUpdateFormatted: 'Hace 3 horas',
		coordinates: { lat: 20.542, lng: -100.318 }
	},
	{
		id: 'VH005',
		name: 'Unidad 05 — SUV',
		driver: 'Luis Herrera',
		deviceId: '0848086005',
		status: 'maintenance',
		location: 'Taller Central — Zibatá',
		latitude: 20.675,
		longitude: -100.354,
		speed: 0,
		battery: 45,
		fuel: 45,
		lastUpdate: new Date(Date.now() - 12 * 60 * 60000).toISOString(),
		lastUpdateFormatted: 'Hace 12 horas',
		coordinates: { lat: 20.675, lng: -100.354 }
	},
	{
		id: 'VH006',
		name: 'Unidad 06 — Motocicleta',
		driver: 'Diana Torres',
		deviceId: '0848086006',
		status: 'active',
		location: 'Desarrollo San Pablo',
		latitude: 20.576,
		longitude: -100.359,
		speed: 58,
		battery: 88,
		fuel: 88,
		lastUpdate: new Date(Date.now() - 30000).toISOString(),
		lastUpdateFormatted: 'Hace menos de 1 minuto',
		coordinates: { lat: 20.576, lng: -100.359 }
	}
];

export const activeVehicles = derived(vehicles, ($vehicles) =>
	$vehicles.filter((vehicle) => vehicle.status === 'active')
);

// Store derivado para contar vehículos seleccionados
export const selectedVehicleCount = derived(selectedVehicles, ($selected) => $selected.length);

function hasVehicleCoords(v) {
	const lat = v.latitude ?? v.lat;
	const lng = v.longitude ?? v.lng;
	return lat != null && lng != null && !Number.isNaN(Number(lat)) && !Number.isNaN(Number(lng));
}

/** Evita duplicados por `id`; */
function mergeVehicleLists(...lists) {
	const byId = new Map();
	for (const list of lists) {
		for (const v of list) {
			if (!v?.id) continue;
			const prev = byId.get(v.id);
			if (!prev) {
				byId.set(v.id, v);
			} else if (hasVehicleCoords(v) && !hasVehicleCoords(prev)) {
				byId.set(v.id, v);
			}
		}
	}
	return [...byId.values()];
}

// Funciones para manejar vehículos
export const vehicleActions = {
	// Cargar vehículos desde la API
	async loadVehicles() {
		loadingVehicles.set(true);
		try {
			if (import.meta.env.DEV) {
				vehicles.set(EXAMPLE_VEHICLES.map((v) => ({ ...v })));
				return;
			}

			try {
				const response = await apiService.getVehicles();
				const apiVehicles = response.vehicles || response || [];
				const allVehicles = mergeVehicleLists(VEHICLE_CONFIG, apiVehicles, EXAMPLE_VEHICLES);
				vehicles.set(allVehicles);
				await this.loadVehiclePositions();
			} catch (error) {
				console.warn('Error cargando vehículos desde API, usando configuración local:', error);
				vehicles.set(mergeVehicleLists(VEHICLE_CONFIG, EXAMPLE_VEHICLES));
				await this.loadVehiclePositions();
			}
		} finally {
			loadingVehicles.set(false);
		}
	},

	// Cargar posiciones de vehículos
	async loadVehiclePositions() {
		if (import.meta.env.DEV) {
			loadingPositions.set(false);
			return;
		}
		loadingPositions.set(true);
		try {
			const currentVehicles = get(vehicles);

			const vehiclesWithDeviceId = currentVehicles.filter((v) => v.deviceId);
			const deviceIds = vehiclesWithDeviceId.map((v) => v.deviceId);

			if (deviceIds.length > 0) {
				const positions = await positionService.getMultiplePositions(deviceIds);
				const positionMap = new Map();

				positions.forEach((position) => {
					if (position) {
						positionMap.set(position.deviceId, position);
					}
				});

				vehiclePositions.set(positionMap);

				// Actualizar vehículos con datos de posición
				const updatedVehicles = currentVehicles.map((vehicle) => {
					if (vehicle.deviceId) {
						const position = positionMap.get(vehicle.deviceId);
						if (position) {
							return {
								...vehicle,
								latitude: position.latitude,
								longitude: position.longitude,
								speed: position.speed,
								battery: position.battery,
								status: position.isOnline ? 'active' : 'inactive',
								lastUpdate: position.lastUpdate,
								lastUpdateFormatted: position.lastUpdateFormatted,
								coordinates: position.coordinates
							};
						}
					}
					return vehicle;
				});

				vehicles.set(updatedVehicles);
			}
		} catch (error) {
			console.error('Error cargando posiciones:', error);
		} finally {
			loadingPositions.set(false);
		}
	},

	// Actualizar posición de un vehículo específico
	async updateVehiclePosition(deviceId) {
		try {
			const position = await positionService.getLastPosition(deviceId);

			vehiclePositions.update((positions) => {
				const newPositions = new Map(positions);
				newPositions.set(deviceId, position);
				return newPositions;
			});

			// Actualizar el vehículo en la lista
			vehicles.update((vehicleList) => {
				return vehicleList.map((vehicle) => {
					if (vehicle.deviceId === deviceId) {
						return {
							...vehicle,
							latitude: position.latitude,
							longitude: position.longitude,
							speed: position.speed,
							battery: position.battery,
							status: position.isOnline ? 'active' : 'inactive',
							lastUpdate: position.lastUpdate,
							lastUpdateFormatted: position.lastUpdateFormatted,
							coordinates: position.coordinates
						};
					}
					return vehicle;
				});
			});

			return position;
		} catch (error) {
			console.error(`Error actualizando posición para ${deviceId}:`, error);
			throw error;
		}
	},

	// Seleccionar/deseleccionar vehículo
	toggleVehicleSelection(vehicleId) {
		selectedVehicles.update((selected) => {
			if (selected.includes(vehicleId)) {
				return selected.filter((id) => id !== vehicleId);
			} else {
				return [...selected, vehicleId];
			}
		});
	},

	// Seleccionar todos los vehículos
	selectAllVehicles() {
		vehicles.subscribe((vehicleList) => {
			selectedVehicles.set(vehicleList.map((v) => v.id));
		})();
	},

	// Limpiar selección
	clearSelection() {
		selectedVehicles.set([]);
	},

	// Obtener vehículo por ID
	getVehicleById(vehicleId) {
		let foundVehicle = null;
		vehicles.subscribe((vehicleList) => {
			foundVehicle = vehicleList.find((v) => v.id === vehicleId);
		})();
		return foundVehicle;
	}
};
