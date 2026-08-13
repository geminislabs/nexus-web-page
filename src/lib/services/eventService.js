import { authToken } from '$lib/stores/auth.js';
import { normalizeEvent } from '$lib/utils/eventUtils.js';

const COMM_API_URL = import.meta.env?.VITE_COMM_API_URL || 'http://localhost:8000';

class EventService {
	/**
	 * @param {string} unitId
	 * @param {{ from?: Date|string, to?: Date|string, limit?: number }} [options]
	 */
	async getEventsForUnit(unitId, options = {}) {
		const limit = options.limit ?? 50;
		const { from: dayFrom, to: dayTo } = (() => {
			const to = options.to ? new Date(options.to) : new Date();
			const from = options.from
				? new Date(options.from)
				: (() => {
						const d = new Date(to);
						d.setHours(0, 0, 0, 0);
						return d;
					})();
			return { from, to };
		})();

		const url = new URL('/api/v1/events', COMM_API_URL);
		url.searchParams.append('unit_id', unitId);
		url.searchParams.set('from', dayFrom.toISOString());
		url.searchParams.set('to', dayTo.toISOString());
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
