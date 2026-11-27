import { instrumentedFetch } from '$lib/observability/http.js';
import { normalizeEvent } from '$lib/utils/eventUtils.js';
import { withDataToken } from './dataToken.js';

/** Fail-closed: sin VITE_COMM_API_URL no se llama a un host cableado. */
const COMM_API_URL = String(import.meta.env?.VITE_COMM_API_URL ?? '')
	.trim()
	.replace(/\/$/, '');

class EventService {
	/**
	 * Eventos del dispositivo (ignición, etc.) de varias unidades. `siscom-api`
	 * acepta hasta 100 unidades por petición y pagina con cursor.
	 * @param {{ unitIds: string[], from: Date|string, to: Date|string, limit?: number, order?: 'asc'|'desc', cursor?: string|null }} q
	 * @returns {Promise<{ events: ReturnType<typeof normalizeEvent>[], nextCursor: string|null }>}
	 */
	async getEvents({ unitIds, from, to, limit = 50, order = 'desc', cursor = null }) {
		if (!COMM_API_URL) {
			throw new Error('VITE_COMM_API_URL is not configured');
		}
		const url = new URL('/api/v1/events', COMM_API_URL);
		for (const id of unitIds) url.searchParams.append('unit_id', id);
		url.searchParams.set('from', new Date(from).toISOString());
		url.searchParams.set('to', new Date(to).toISOString());
		url.searchParams.set('limit', String(limit));
		url.searchParams.set('order', order);
		if (cursor) url.searchParams.set('cursor', cursor);

		const json = await withDataToken(
			(dataToken) =>
				instrumentedFetch(url.toString(), {
					method: 'GET',
					headers: { Accept: 'application/json', Authorization: `Bearer ${dataToken}` },
					route: '/api/v1/events',
					targetService: 'siscom-api'
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
			nextCursor: json?.next_cursor ?? json?.nextCursor ?? null
		};
	}

	/**
	 * @param {string} unitId
	 * @param {{ from?: Date|string, to?: Date|string, limit?: number }} [options]
	 */
	async getEventsForUnit(unitId, options = {}) {
		const to = options.to ? new Date(options.to) : new Date();
		const from = options.from
			? new Date(options.from)
			: (() => {
					const d = new Date(to);
					d.setHours(0, 0, 0, 0);
					return d;
				})();
		return this.getEvents({ unitIds: [unitId], from, to, limit: options.limit ?? 50 });
	}
}

export const eventService = new EventService();
