import { writable, derived, get } from 'svelte/store';
import { apiService } from '$lib/services/api.js';
import { positionService } from '$lib/services/positionService.js';
import { mapService } from '$lib/services/mapService.js';
import { colorSlugToHex, formatLastUpdate } from '$lib/utils/vehicleUtils.js';

// Estado principal de vehículos
export const vehicles = writable([]);
export const selectedVehicles = writable([]);
/** IDs de unidades visibles en el mapa (marcadores). */
export const mapVisibleUnitIds = writable([]);
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

export const mapVisibleUnitCount = derived(mapVisibleUnitIds, ($ids) => $ids.length);

/** Sincroniza visibilidad: nuevas unidades visibles; elimina IDs que ya no existen. */
function syncMapVisibleIds(vehicleList) {
	const ids = vehicleList.map((v) => String(v?.id || '')).filter(Boolean);
	const idSet = new Set(ids);
	mapVisibleUnitIds.update((prev) => {
		if (!Array.isArray(prev) || prev.length === 0) return ids;
		const kept = prev.filter((id) => idSet.has(String(id)));
		const keptSet = new Set(kept);
		const added = ids.filter((id) => !keptSet.has(id));
		return [...kept, ...added];
	});
}

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
		lastUpdateFormatted: createdAt ? formatLastUpdate(createdAt) : '',
		color: unit?.color ?? null,
		profile_color_hex: colorSlugToHex(unit?.color) ?? null,
		icon_type: unit?.icon_type || unit?.iconType || null,
		iconType: unit?.icon_type || unit?.iconType || null,
		brand: unit?.brand ?? null,
		model: unit?.model ?? null,
		year: unit?.year ?? null,
		plate: unit?.plate ?? null,
		vin: unit?.vin ?? null
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

function sanitizeUnitPayload(payload = {}) {
	const out = {};
	if (typeof payload.name === 'string') out.name = payload.name.trim();
	if (payload.description === null) out.description = null;
	else if (typeof payload.description === 'string') out.description = payload.description.trim();
	return out;
}

function sanitizeProfilePayload(payload = {}) {
	const out = {};
	if (payload.description === null) out.description = null;
	else if (typeof payload.description === 'string') out.description = payload.description.trim();
	if (payload.brand === null) out.brand = null;
	else if (typeof payload.brand === 'string') out.brand = payload.brand.trim() || null;
	if (payload.model === null) out.model = null;
	else if (typeof payload.model === 'string') out.model = payload.model.trim() || null;
	if (payload.plate === null) out.plate = null;
	else if (typeof payload.plate === 'string') out.plate = payload.plate.trim() || null;
	if (payload.vin === null) out.vin = null;
	else if (typeof payload.vin === 'string') out.vin = payload.vin.trim() || null;
	if (payload.color === null) out.color = null;
	else if (typeof payload.color === 'string') out.color = payload.color || null;
	if (payload.icon_type === null) out.icon_type = null;
	else if (typeof payload.icon_type === 'string') out.icon_type = payload.icon_type || null;
	if (payload.year === null) out.year = null;
	else if (typeof payload.year === 'number' && !Number.isNaN(payload.year)) out.year = payload.year;
	return out;
}

function mapProfileToVehicleFields(profile) {
	if (!profile) return {};
	return {
		color: profile.color ?? null,
		profile_color_hex: colorSlugToHex(profile.color) ?? null,
		icon_type: profile.icon_type ?? null,
		iconType: profile.icon_type ?? null,
		description: profile.description ?? undefined,
		brand: profile.brand ?? null,
		model: profile.model ?? null,
		year: profile.year ?? null,
		plate: profile.vehicle?.plate ?? null,
		vin: profile.vehicle?.vin ?? null
	};
}

function sanitizeCreatePayload(payload = {}) {
	const out = { ...sanitizeUnitPayload(payload) };
	const deviceId = payload.deviceId ?? payload.device_id;
	if (typeof deviceId === 'string' && deviceId.trim()) out.deviceId = deviceId.trim();

	const profile = sanitizeProfilePayload(payload);
	if (profile.icon_type) out.iconType = profile.icon_type;
	if (profile.brand) out.brand = profile.brand;
	if (profile.model) out.model = profile.model;
	if (profile.color) out.color = profile.color;
	if (profile.year != null) out.year = profile.year;
	if (profile.plate) out.plate = profile.plate;
	if (profile.vin) out.vin = profile.vin;
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
			const merged = mergeVehicleLists(apiVehicles);
			vehicles.set(merged);
			syncMapVisibleIds(merged);
			await this.loadVehiclePositions();
		} catch (error) {
			console.error('Error cargando unidades desde API:', error);
			vehicles.set([]);
			mapVisibleUnitIds.set([]);
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
								coordinates: position.coordinates,
								fixStatus: position.fixStatus,
								engineStatus: position.engineStatus,
								satellites: position.satellites,
								rxLvl: position.rxLvl,
								mainBatteryVoltage: position.mainBatteryVoltage,
								backupBatteryVoltage: position.backupBatteryVoltage
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
			const visible = get(mapVisibleUnitIds);
			if (visible.includes(String(updatedVehicle.id))) {
				mapService.updateVehicleMarker(updatedVehicle);
			}
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
							coordinates: position.coordinates,
							fixStatus: position.fixStatus,
							engineStatus: position.engineStatus,
							satellites: position.satellites,
							rxLvl: position.rxLvl,
							mainBatteryVoltage: position.mainBatteryVoltage,
							backupBatteryVoltage: position.backupBatteryVoltage
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

	/** ¿La unidad se muestra en el mapa? */
	isVisibleOnMap(vehicleId) {
		return get(mapVisibleUnitIds).includes(String(vehicleId));
	},

	toggleMapVisibility(vehicleId) {
		const id = String(vehicleId ?? '');
		if (!id) return;
		mapVisibleUnitIds.update((ids) => {
			if (ids.includes(id)) return ids.filter((x) => x !== id);
			return [...ids, id];
		});
	},

	setMapVisibility(vehicleId, visible) {
		const id = String(vehicleId ?? '');
		if (!id) return;
		mapVisibleUnitIds.update((ids) => {
			const has = ids.includes(id);
			if (visible && !has) return [...ids, id];
			if (!visible && has) return ids.filter((x) => x !== id);
			return ids;
		});
	},

	/** Muestra u oculta un conjunto de IDs (p. ej. resultados filtrados). */
	setMapVisibilityForIds(vehicleIds, visible) {
		const target = new Set((vehicleIds || []).map((id) => String(id)).filter(Boolean));
		if (target.size === 0) return;
		mapVisibleUnitIds.update((ids) => {
			if (visible) {
				const next = new Set(ids);
				target.forEach((id) => next.add(id));
				return [...next];
			}
			return ids.filter((id) => !target.has(id));
		});
	},

	showAllOnMap() {
		mapVisibleUnitIds.set(get(vehicles).map((v) => String(v.id)));
	},

	hideAllOnMap() {
		mapVisibleUnitIds.set([]);
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
		const created = await apiService.createVehicle(sanitizeCreatePayload(payload));
		const mapped = mapUnitToVehicle(created);
		if (payload.deviceId || payload.device_id) {
			mapped.deviceId = payload.deviceId || payload.device_id;
		}
		vehicles.update((list) => [mapped, ...list.filter((v) => v.id !== mapped.id)]);
		mapVisibleUnitIds.update((ids) =>
			ids.includes(mapped.id) ? ids : [...ids, String(mapped.id)]
		);
		return mapped;
	},

	async updateUnitDevice(unitId, deviceId) {
		if (!unitId) return null;
		if (deviceId) {
			await apiService.assignUnitDevice(unitId, deviceId);
		} else {
			await apiService.unassignUnitDevice(unitId);
		}
		return this.fetchVehicle(unitId);
	},

	async updateVehicle(vehicleId, payload) {
		if (!vehicleId) return null;

		const existing = this.getVehicleById(vehicleId);
		const unitPayload = sanitizeUnitPayload(payload);
		const profilePayload = sanitizeProfilePayload(payload);

		let merged = existing ? { ...existing } : { id: String(vehicleId) };

		if (Object.keys(unitPayload).length > 0) {
			const updatedUnit = await apiService.updateVehicle(vehicleId, unitPayload);
			merged = mergeVehicleDetail(merged, mapUnitToVehicle(updatedUnit));
		}

		if (Object.keys(profilePayload).length > 0) {
			const profile = await apiService.updateUnitProfile(vehicleId, profilePayload);
			merged = { ...merged, ...mapProfileToVehicleFields(profile) };
		}

		vehicles.update((list) =>
			list.map((v) => (String(v.id) === String(vehicleId) ? mergeVehicleDetail(v, merged) : v))
		);
		return merged;
	},

	async deleteVehicle(vehicleId) {
		if (!vehicleId) return;
		await apiService.deleteVehicle(vehicleId);
		const id = String(vehicleId);
		vehicles.update((list) => list.filter((v) => v.id !== vehicleId));
		selectedVehicles.update((list) => list.filter((x) => x !== vehicleId && x !== id));
		mapVisibleUnitIds.update((list) => list.filter((x) => x !== id));
	},

	setActiveUnit(unitId) {
		activeUnitId.set(unitId);
	}
};
