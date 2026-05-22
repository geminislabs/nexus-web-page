/**
 * Construye query string omitiendo valores vacíos.
 * @param {Record<string, unknown>} params
 * @returns {string} Query sin `?` inicial, o cadena vacía.
 */
export function buildQueryString(params = {}) {
	const qs = new URLSearchParams();
	for (const [key, value] of Object.entries(params)) {
		if (value === undefined || value === null || value === '') continue;
		if (Array.isArray(value)) {
			for (const item of value) {
				if (item === undefined || item === null || item === '') continue;
				qs.append(key, String(item));
			}
			continue;
		}
		qs.set(key, String(value));
	}
	return qs.toString();
}

/**
 * @param {string} path
 * @param {Record<string, unknown>} [params]
 */
export function withQuery(path, params) {
	const query = buildQueryString(params);
	return query ? `${path}?${query}` : path;
}
