import { writable, derived } from 'svelte/store';
import { apiService } from '$lib/services/api.js';
import { logger } from '$lib/utils/logger.js';

export const trips = writable([]);
export const selectedTripId = writable(null);
export const loadingTrips = writable(false);
export const tripError = writable(null);

export const selectedTrip = derived([trips, selectedTripId], ([$trips, $selectedTripId]) => {
	if (!$selectedTripId) return null;
	return $trips.find((t) => t.trip_id === $selectedTripId) || null;
});

function formatDate(date) {
	return date.toISOString();
}

function getTodayRange() {
	const now = new Date();
	const start = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0);
	const end = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59);
	return { start, end };
}

export const tripActions = {
	async loadTripsForUnit(unitId, options = {}) {
		if (!unitId) return [];

		loadingTrips.set(true);
		tripError.set(null);

		try {
			const { start, end } = options.dateRange || getTodayRange();
			const params = {
				start_date: formatDate(start),
				end_date: formatDate(end),
				limit: options.limit || 50
			};

			if (options.cursor) {
				params.cursor = options.cursor;
			}

			const response = await apiService.request(
				`/units/${encodeURIComponent(unitId)}/trips?${new URLSearchParams(params)}`,
				{ method: 'GET' }
			);

			const tripList = response?.trips || [];
			trips.set(tripList);
			return {
				trips: tripList,
				hasMore: response?.has_more || false,
				cursor: response?.cursor || null,
				total: response?.total || tripList.length
			};
		} catch (error) {
			logger.error('Error cargando trayectos:', error);
			tripError.set(error.message || 'Error al cargar trayectos');
			trips.set([]);
			return { trips: [], hasMore: false, cursor: null, total: 0 };
		} finally {
			loadingTrips.set(false);
		}
	},

	async loadTripDetail(tripId, options = {}) {
		if (!tripId) return null;

		try {
			const params = new URLSearchParams();
			if (options.includePoints) params.set('include_points', 'true');
			if (options.includeAlerts) params.set('include_alerts', 'true');
			if (options.includeEvents) params.set('include_events', 'true');

			const queryString = params.toString();
			const url = `/trips/${encodeURIComponent(tripId)}${queryString ? `?${queryString}` : ''}`;

			const detail = await apiService.request(url, { method: 'GET' });

			trips.update((list) => list.map((t) => (t.trip_id === tripId ? { ...t, ...detail } : t)));

			return detail;
		} catch (error) {
			logger.error('Error cargando detalle del trayecto:', error);
			return null;
		}
	},

	selectTrip(tripId) {
		selectedTripId.set(tripId);
	},

	clearSelection() {
		selectedTripId.set(null);
	},

	clearTrips() {
		trips.set([]);
		selectedTripId.set(null);
		tripError.set(null);
	}
};
