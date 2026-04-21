import { writable, derived, get } from 'svelte/store';
import { apiService } from '$lib/services/api.js';
import { positionService } from '$lib/services/positionService.js';
import { mapService } from '$lib/services/mapService.js';
import { bypassAuthInDev } from '$lib/config/env.js';
import { formatLastUpdate } from '$lib/utils/vehicleUtils.js';

// Estado principal de vehículos
export const vehicles = writable([]);
export const selectedVehicles = writable([]);
export const loadingVehicles = writable(false);
export const vehiclePositions = writable(new Map());
export const loadingPositions = writable(false);

// Datos de ejemplo para entorno mock (bypass activo)
const EXAMPLE_VEHICLES = [
	{
		id: 'VH001',
		name: 'Unidad 01 — Sedán',
		driver: 'Carlos Mendoza',
		deviceId: 'test-123',
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

function mapUnitToVehicle(unit) {
	const createdAt = unit?.created_at || null;
	return {
		id: String(unit?.id || ''),
		name: unit?.name || 'Unidad',
		description: unit?.description || '',
		driver: '',
		deviceId: unit?.device_id || null,
		status: unit?.deleted_at ? 'inactive' : 'active',
		location: unit?.description || '',
		lastUpdate: createdAt,
		lastUpdateFormatted: createdAt ? formatLastUpdate(createdAt) : ''
	};
}

function sanitizeVehicleUpdatePayload(payload = {}) {
	const out = {};
	if (typeof payload.name === 'string') out.name = payload.name.trim();
	if (typeof payload.description === 'string') out.description = payload.description.trim();
	return out;
}

// Funciones para manejar vehículos
export const vehicleActions = {
	// Cargar vehículos desde la API
	async loadVehicles() {
		loadingVehicles.set(true);
		try {
			if (bypassAuthInDev) {
				vehicles.set(EXAMPLE_VEHICLES.map((v) => ({ ...v })));
				return;
			}

			try {
				const unitList = await apiService.getVehicles();
				const apiVehicles = Array.isArray(unitList) ? unitList.map(mapUnitToVehicle) : [];
				vehicles.set(mergeVehicleLists(apiVehicles));
				await this.loadVehiclePositions();
			} catch (error) {
				console.error('Error cargando unidades desde API:', error);
				vehicles.set([]);
			}
		} finally {
			loadingVehicles.set(false);
		}
	},

	// Cargar posiciones de vehículos
	async loadVehiclePositions() {
		if (bypassAuthInDev) {
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

	/**
	 * Aplica una posición recibida por WebSocket (siscom-api stream) y mueve el marcador en el mapa.
	 * @param {{ deviceId: string; latitude: number; longitude: number; speed?: number }} payload
	 */
	applyLivePosition(payload) {
		const did = String(payload?.deviceId ?? '');
		if (!did) return;

		const lat = Number(payload.latitude);
		const lng = Number(payload.longitude);
		if (Number.isNaN(lat) || Number.isNaN(lng)) return;

		let updatedVehicle = null;
		vehicles.update((vehicleList) =>
			vehicleList.map((vehicle) => {
				if (String(vehicle.deviceId ?? '') !== did) return vehicle;
				const now = new Date().toISOString();
				updatedVehicle = {
					...vehicle,
					latitude: lat,
					longitude: lng,
					...(payload.speed != null && !Number.isNaN(Number(payload.speed))
						? { speed: Number(payload.speed) }
						: {}),
					coordinates: { lat, lng },
					lastUpdate: now,
					lastUpdateFormatted: formatLastUpdate(now),
					status: 'active'
				};
				return updatedVehicle;
			})
		);

		if (updatedVehicle && mapService.map) {
			mapService.updateVehicleMarker(updatedVehicle);
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
	},

	async fetchVehicle(vehicleId) {
		if (!vehicleId) return null;
		if (bypassAuthInDev) {
			return this.getVehicleById(vehicleId);
		}

		const unit = await apiService.getVehicle(vehicleId);
		const mapped = mapUnitToVehicle(unit);
		vehicles.update((list) => {
			const exists = list.some((v) => v.id === mapped.id);
			if (!exists) return [mapped, ...list];
			return list.map((v) => (v.id === mapped.id ? mapped : v));
		});
		return mapped;
	},

	async createVehicle(payload) {
		if (bypassAuthInDev) {
			const newVehicle = {
				id: `VH${Date.now()}`,
				name: payload?.name?.trim() || 'Unidad',
				description: payload?.description?.trim() || '',
				driver: '',
				deviceId: null,
				status: 'active',
				location: payload?.description?.trim() || ''
			};
			vehicles.update((list) => [newVehicle, ...list]);
			return newVehicle;
		}
		const created = await apiService.createVehicle(sanitizeVehicleUpdatePayload(payload));
		const mapped = mapUnitToVehicle(created);
		vehicles.update((list) => [mapped, ...list.filter((v) => v.id !== mapped.id)]);
		return mapped;
	},

	async updateVehicle(vehicleId, payload) {
		if (!vehicleId) return null;
		if (bypassAuthInDev) {
			const sanitized = sanitizeVehicleUpdatePayload(payload);
			let updated = null;
			vehicles.update((list) =>
				list.map((v) => {
					if (v.id !== vehicleId) return v;
					updated = { ...v, ...sanitized, location: sanitized.description ?? v.location };
					return updated;
				})
			);
			return updated;
		}
		const updatedUnit = await apiService.updateVehicle(vehicleId, sanitizeVehicleUpdatePayload(payload));
		const mapped = mapUnitToVehicle(updatedUnit);
		vehicles.update((list) => list.map((v) => (v.id === vehicleId ? mapped : v)));
		return mapped;
	},

	async deleteVehicle(vehicleId) {
		if (!vehicleId) return;
		if (!bypassAuthInDev) {
			await apiService.deleteVehicle(vehicleId);
		}
		vehicles.update((list) => list.filter((v) => v.id !== vehicleId));
		selectedVehicles.update((list) => list.filter((id) => id !== vehicleId));
	}
};
