import { writable, derived, get } from 'svelte/store';
import { apiService } from '$lib/services/api.js';
import { positionService } from '$lib/services/positionService.js';
import { mapService } from '$lib/services/mapService.js';
import { formatLastUpdate } from '$lib/utils/vehicleUtils.js';

// Estado principal de vehículos
export const vehicles = writable([]);
export const selectedVehicles = writable([]);
export const activeUnitId = writable(null);
export const loadingVehicles = writable(false);
export const vehiclePositions = writable(new Map());
export const loadingPositions = writable(false);

export const activeVehicles = derived(vehicles, ($vehicles) =>
	$vehicles.filter((vehicle) => vehicle.status === 'active')
);

export const activeUnit = derived([vehicles, activeUnitId], ([$vehicles, $activeUnitId]) => {
	if (!$activeUnitId) return null;
	return $vehicles.find((vehicle) => vehicle.id === $activeUnitId) || null;
});

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
		deviceId: unit?.device_id || unit?.deviceId || null,
		status: unit?.deleted_at ? 'inactive' : 'active',
		location: unit?.description || '',
		lastUpdate: createdAt,
		lastUpdateFormatted: createdAt ? formatLastUpdate(createdAt) : ''
	};
}

/** GET /units/{id} no incluye device_id; conservar datos ya cargados del listado. */
function mergeVehicleDetail(existing, mapped) {
	if (!existing) return mapped;
	return {
		...existing,
		...mapped,
		deviceId: mapped.deviceId || existing.deviceId || null,
		latitude: mapped.latitude ?? existing.latitude,
		longitude: mapped.longitude ?? existing.longitude,
		speed: mapped.speed ?? existing.speed,
		battery: mapped.battery ?? existing.battery,
		fuel: mapped.fuel ?? existing.fuel,
		lastUpdate: mapped.lastUpdate || existing.lastUpdate,
		lastUpdateFormatted: mapped.lastUpdateFormatted || existing.lastUpdateFormatted,
		coordinates: mapped.coordinates || existing.coordinates,
		status: existing.latitude != null ? existing.status : mapped.status
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
			const unitList = await apiService.getVehicles();
			const apiVehicles = Array.isArray(unitList) ? unitList.map(mapUnitToVehicle) : [];
			vehicles.set(mergeVehicleLists(apiVehicles));
			await this.loadVehiclePositions();
		} catch (error) {
			console.error('Error cargando unidades desde API:', error);
			vehicles.set([]);
		} finally {
			loadingVehicles.set(false);
		}
	},

	// Cargar posiciones de vehículos
	async loadVehiclePositions() {
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

		const existing = this.getVehicleById(vehicleId);
		const unit = await apiService.getVehicle(vehicleId);
		let mapped = mergeVehicleDetail(existing, mapUnitToVehicle(unit));

		if (!mapped.deviceId) {
			const units = await apiService.getUnits();
			const fromList = Array.isArray(units)
				? units.find((u) => String(u?.id) === String(vehicleId))
				: null;
			if (fromList?.device_id || fromList?.deviceId) {
				mapped = {
					...mapped,
					deviceId: fromList.device_id || fromList.deviceId
				};
			}
		}

		vehicles.update((list) => {
			const exists = list.some((v) => v.id === mapped.id);
			if (!exists) return [mapped, ...list];
			return list.map((v) => (v.id === mapped.id ? mapped : v));
		});
		return mapped;
	},

	async createVehicle(payload) {
		const created = await apiService.createVehicle(sanitizeVehicleUpdatePayload(payload));
		const mapped = mapUnitToVehicle(created);
		vehicles.update((list) => [mapped, ...list.filter((v) => v.id !== mapped.id)]);
		return mapped;
	},

	async updateVehicle(vehicleId, payload) {
		if (!vehicleId) return null;
		const updatedUnit = await apiService.updateVehicle(
			vehicleId,
			sanitizeVehicleUpdatePayload(payload)
		);
		const mapped = mapUnitToVehicle(updatedUnit);
		vehicles.update((list) => list.map((v) => (v.id === vehicleId ? mapped : v)));
		return mapped;
	},

	async deleteVehicle(vehicleId) {
		if (!vehicleId) return;
		await apiService.deleteVehicle(vehicleId);
		vehicles.update((list) => list.filter((v) => v.id !== vehicleId));
		selectedVehicles.update((list) => list.filter((id) => id !== vehicleId));
	},

	setActiveUnit(unitId) {
		activeUnitId.set(unitId);
	}
};
