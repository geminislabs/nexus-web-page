/**
 * Error tipado para respuestas HTTP de siscom-admin-api.
 * `detail`/`body` quedan para diagnóstico interno; la UI usa displayMessage (sin filtrar stacks/SQL).
 */

const SAFE_BY_STATUS = {
	400: 'Solicitud inválida. Revisa los datos e intenta de nuevo.',
	401: 'Sesión no válida. Inicia sesión nuevamente.',
	403: 'No tienes permiso para realizar esta acción.',
	404: 'No se encontró el recurso solicitado.',
	408: 'La solicitud tardó demasiado. Intenta de nuevo.',
	409: 'Conflicto con el estado actual. Actualiza e intenta de nuevo.',
	422: 'No se pudieron validar los datos enviados.',
	429: 'Demasiadas solicitudes. Espera un momento e intenta de nuevo.',
	500: 'Error del servidor. Intenta más tarde.',
	502: 'Servicio no disponible temporalmente.',
	503: 'Servicio en mantenimiento. Intenta más tarde.',
	504: 'El servidor no respondió a tiempo.'
};

/** Mensajes cortos del backend que son seguros y útiles en UI (auth / invite). */
const SAFE_DETAIL_ALLOW =
	/^(email no verificado|invitación pendiente|credenciales inválidas|usuario no encontrado|código inválido|código expirado|password|contraseña)/i;

/** @param {string} msg */
function looksLikeInternalLeak(msg) {
	return /traceback|exception|sql|stack|at\s+\w+\.|\{"|<\/?\w+>|postgres|cognito|arn:aws/i.test(
		msg
	);
}

/** @param {unknown} detail */
function extractDetailString(detail) {
	if (typeof detail === 'string' && detail.trim()) return detail.trim();
	if (detail && typeof detail === 'object' && 'detail' in detail) {
		const nested = /** @type {{ detail?: unknown }} */ (detail).detail;
		if (typeof nested === 'string' && nested.trim()) return nested.trim();
	}
	return null;
}

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

	/** Texto seguro para UI — no reenvía bodies internos del backend. */
	get displayMessage() {
		const raw = extractDetailString(this.detail);
		if (raw && raw.length <= 120 && !looksLikeInternalLeak(raw) && SAFE_DETAIL_ALLOW.test(raw)) {
			return raw;
		}
		if (SAFE_BY_STATUS[this.status]) return SAFE_BY_STATUS[this.status];
		if (typeof this.message === 'string' && this.message.trim()) {
			const m = this.message.trim();
			if (m.length <= 120 && !looksLikeInternalLeak(m) && !/^HTTP error/i.test(m)) return m;
		}
		return 'Ocurrió un error. Intenta de nuevo.';
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
