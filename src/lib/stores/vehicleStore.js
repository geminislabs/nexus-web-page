import { writable, derived, get } from 'svelte/store';
import { writable, derived, get } from 'svelte/store';
import { apiService } from '$lib/services/api.js';
import { positionService } from '$lib/services/positionService.js';
import { mapService } from '$lib/services/mapService.js';
import { formatLastUpdate } from '$lib/utils/vehicleUtils.js';

export const vehicles = writable([]);
export const selectedVehicles = writable([]);
export const loadingVehicles = writable(false);
export const vehiclePositions = writable(new Map());
export const loadingPositions = writable(false);

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

export const vehicleActions = {
	async loadVehicles() {
		loadingVehicles.set(true);
		try {
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
			const index = selected.indexOf(vehicleId);
			if (index === -1) {
				selected.push(vehicleId);
			} else {
				selected.splice(index, 1);
			}
			return [...selected];
		});
	},

	selectAllVehicles() {
		vehicles.subscribe((vehicleList) => {
			selectedVehicles.set(vehicleList.map((v) => v.id || v.deviceId));
		})();
	},

	clearSelection() {
		selectedVehicles.set([]);
	},

	getVehicleById(vehicleId) {
		let result = null;
		vehicles.subscribe((vehicleList) => {
			result = vehicleList.find((v) => v.id === vehicleId || v.deviceId === vehicleId);
		})();
		return result;
	},

	addVehicle(vehicle) {
		vehicles.update((vehicleList) => {
			const existing = vehicleList.find(
				(v) => v.id === vehicle.id || v.deviceId === vehicle.deviceId
			);
			if (!existing) {
				return [...vehicleList, vehicle];
			}
			return vehicleList;
		});
	},

	removeVehicle(vehicleId) {
		vehicles.update((vehicleList) => {
			return vehicleList.filter((v) => v.id !== vehicleId && v.deviceId !== vehicleId);
		});
	},

	updateVehicle(vehicleId, updates) {
		vehicles.update((vehicleList) => {
			return vehicleList.map((vehicle) => {
				if (vehicle.id === vehicleId || vehicle.deviceId === vehicleId) {
					return { ...vehicle, ...updates };
				}
				return vehicle;
			});
		});
	},

	async loadVehicleProfiles() {
		const currentVehicles = get(vehicles);
		if (!currentVehicles.length) return;

		// Filter vehicles that have a unit_id to fetch profile
		const vehiclesToFetch = currentVehicles.filter((v) => v.unit_id);

		if (vehiclesToFetch.length === 0) return;

		try {
			// Fetch all profiles in parallel
			const profiles = await Promise.all(
				vehiclesToFetch.map(async (v) => {
					try {
						const profile = await apiService.getUnitProfile(v.unit_id);
						return { deviceId: v.deviceId, profile };
					} catch (err) {
						console.warn(`Failed to load profile for unit ${v.unit_id}`, err);
						return null;
					}
				})
			);

			// Update store with new info
			vehicles.update((list) => {
				return list.map((vehicle) => {
					const result = profiles.find((p) => p && p.deviceId === vehicle.deviceId);
					if (result && result.profile) {
						return {
							...vehicle,
							icon_type: result.profile.icon_type || vehicle.icon_type,
							color: result.profile.color || vehicle.color
						};
					}
					return vehicle;
				});
			});
		} catch (error) {
			console.error('Error batch loading vehicle profiles:', error);
		}
		return foundVehicle;
	},

	async fetchVehicle(vehicleId) {
		if (!vehicleId) return null;

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
	}
};
