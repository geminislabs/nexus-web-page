import { authToken } from '$lib/stores/auth.js';
import { normalizeEvent } from '$lib/utils/eventUtils.js';

const COMM_API_URL = import.meta.env?.VITE_COMM_API_URL || 'http://localhost:8000';

class EventService {
	/**
	 * @param {string} unitId
	 * @param {{ hours?: number, limit?: number }} [options]
	 */
	async getEventsForUnit(unitId, options = {}) {
		const hours = options.hours ?? 48;
		const limit = options.limit ?? 50;
		const to = new Date();
		const from = new Date(to.getTime() - hours * 60 * 60 * 1000);

		const url = new URL('/api/v1/events', COMM_API_URL);
		url.searchParams.append('unit_id', unitId);
		url.searchParams.set('from', from.toISOString());
		url.searchParams.set('to', to.toISOString());
		url.searchParams.set('limit', String(limit));
		url.searchParams.set('order', 'desc');

		const token = authToken.getToken();
		const headers = { Accept: 'application/json' };
		if (token) headers.Authorization = `Bearer ${token}`;

		const res = await fetch(url.toString(), { method: 'GET', headers });
		if (!res.ok) {
			const body = await res.text().catch(() => '');
			throw new Error(body || `Error al cargar eventos (${res.status})`);
		}

		const json = await res.json();
		const list = Array.isArray(json?.data) ? json.data : [];
		return {
			events: list.map(normalizeEvent),
			nextCursor: json.next_cursor ?? json.nextCursor ?? null
		};
	}
}

export const eventService = new EventService();
