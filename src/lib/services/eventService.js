import { normalizeEvent } from '$lib/utils/eventUtils.js';
import { withDataToken } from './dataToken.js';

/** Fail-closed: sin VITE_COMM_API_URL no se llama a un host cableado. */
const COMM_API_URL = String(import.meta.env?.VITE_COMM_API_URL ?? '')
	.trim()
	.replace(/\/$/, '');

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

		if (!COMM_API_URL) {
			throw new Error('VITE_COMM_API_URL is not configured');
		}

		const url = new URL('/api/v1/events', COMM_API_URL);
		url.searchParams.append('unit_id', unitId);
		url.searchParams.set('from', dayFrom.toISOString());
		url.searchParams.set('to', dayTo.toISOString());
		url.searchParams.set('limit', String(limit));
		url.searchParams.set('order', 'desc');

		const json = await withDataToken(
			(dataToken) =>
				fetch(url.toString(), {
					method: 'GET',
					headers: { Accept: 'application/json', Authorization: `Bearer ${dataToken}` }
				}),
			async (res) => {
				if (!res.ok) {
					const body = await res.text().catch(() => '');
					throw new Error(body || `Error al cargar eventos (${res.status})`);
				}
				return res.json();
			}
		);
		const list = Array.isArray(json?.data) ? json.data : [];
		return {
			events: list.map(normalizeEvent),
			nextCursor: json.next_cursor ?? json.nextCursor ?? null
		};
	}
}

export const eventService = new EventService();
