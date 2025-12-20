import { writable, derived, get } from 'svelte/store';
import { apiService } from '$lib/services/api.js';

export const vehicles = writable([]);
export const selectedVehicles = writable([]);
export const loadingVehicles = writable(false);
export const vehiclePositions = writable(new Map());
export const loadingPositions = writable(false);

export const activeVehicles = derived(vehicles, ($v) => $v);
export const selectedVehicleCount = derived(selectedVehicles, ($s) => $s.length);

export const vehicleActions = {
	async loadVehicles() {
		loadingVehicles.set(true);
		try {
			// Esta función se llamará desde el dashboard después de cargar dispositivos
			// Los vehículos se establecerán directamente con vehicles.set()
			return [];
		} finally {
			loadingVehicles.set(false);
		}
	},

	async updateVehiclePosition(deviceId, positionData) {
		vehiclePositions.update((positions) => {
			positions.set(deviceId, {
				...positionData,
				timestamp: new Date().toISOString()
			});
			return positions;
		});

		// También actualizar el vehículo en la lista principal si es necesario
		vehicles.update((vehicleList) => {
			return vehicleList.map((vehicle) => {
				if (vehicle.deviceId === deviceId || vehicle.id === deviceId) {
					return {
						...vehicle,
						...positionData,
						lastUpdate: new Date().toISOString()
					};
				}
				return vehicle;
			});
		});
	},

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
	}
};
