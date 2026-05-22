/**
 * Error tipado para respuestas HTTP de siscom-admin-api.
 */
export class ApiError extends Error {
	/**
	 * @param {string} message
	 * @param {{ status?: number, detail?: unknown, body?: unknown }} [meta]
	 */
	constructor(message, meta = {}) {
		super(message);
		this.name = 'ApiError';
		this.status = meta.status ?? 0;
		this.detail = meta.detail ?? null;
		this.body = meta.body ?? null;
	}

	/** Texto legible para UI (prioriza detail del backend). */
	get displayMessage() {
		if (typeof this.detail === 'string' && this.detail.trim()) return this.detail;
		if (this.detail && typeof this.detail === 'object' && 'detail' in this.detail) {
			const nested = /** @type {{ detail?: unknown }} */ (this.detail).detail;
			if (typeof nested === 'string') return nested;
		}
		return this.message;
	}
}

/**
 * @param {Response} response
 * @returns {Promise<{ detail: unknown, body: unknown }>}
 */
export async function parseErrorBody(response) {
	const contentType = response.headers.get('content-type') || '';
	if (contentType.includes('application/json')) {
		try {
			const body = await response.json();
			const detail =
				body?.detail ?? body?.message ?? (Array.isArray(body?.errors) ? body.errors : null) ?? body;
			return { detail, body };
		} catch {
			return { detail: null, body: null };
		}
	}

	try {
		const text = await response.text();
		return { detail: text || null, body: text };
	} catch {
		return { detail: null, body: null };
	}
}

/**
 * @param {Response} response
 * @param {unknown} [fallbackDetail]
 */
export async function apiErrorFromResponse(response, fallbackDetail) {
	const { detail, body } = await parseErrorBody(response);
	const message =
		(typeof detail === 'string' && detail) ||
		(typeof fallbackDetail === 'string' && fallbackDetail) ||
		`HTTP error! status: ${response.status}`;

	return new ApiError(message, { status: response.status, detail, body });
}
