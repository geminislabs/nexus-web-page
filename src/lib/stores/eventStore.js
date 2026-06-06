import { writable } from 'svelte/store';
import { eventService } from '$lib/services/eventService.js';

export const unitEvents = writable([]);
export const loadingEvents = writable(false);
export const eventsError = writable(null);

export const eventActions = {
	async loadForUnit(unitId) {
		if (!unitId) {
			unitEvents.set([]);
			return [];
		}
		loadingEvents.set(true);
		eventsError.set(null);
		try {
			const { events } = await eventService.getEventsForUnit(unitId);
			unitEvents.set(events);
			return events;
		} catch (err) {
			eventsError.set(err?.message || 'No se pudieron cargar los eventos');
			unitEvents.set([]);
			return [];
		} finally {
			loadingEvents.set(false);
		}
	},
	clear() {
		unitEvents.set([]);
		eventsError.set(null);
	}
};
