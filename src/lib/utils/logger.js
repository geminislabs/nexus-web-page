/**
 * Logger cliente enterprise — listo para observability.
 *
 * - Producción: no escribe en consola; reenvía a sinks registrados (Sentry/Datadog/…).
 * - Desarrollo: consola con evento estructurado sanitizado.
 * - Nunca registra tokens, passwords, Authorization ni PII conocida.
 *
 * Uso:
 *   logger.error({ code: 'AUTH_REFRESH_FAILED', message: 'Token refresh failed', err });
 *   logger.warn('Stream disconnected', { code: 'WS_DISCONNECT', context: { status: 1006 } });
 *
 * Observability (cuando exista):
 *   import { setObservabilitySink } from '$lib/utils/logger.js';
 *   setObservabilitySink((event) => { Sentry.captureMessage(event.message, { extra: event }); });
 */

/** @typedef {'debug' | 'info' | 'warn' | 'error'} LogLevel */

/**
 * @typedef {object} LogEvent
 * @property {LogLevel} level
 * @property {string} message
 * @property {string} [code]
 * @property {string} [requestId]
 * @property {string} timestamp
 * @property {string} [detail]
 * @property {Record<string, string | number | boolean | null>} [context]
 */

const isDev = import.meta.env.DEV === true;

/** @type {((event: LogEvent) => void) | null} */
let observabilitySink = null;

/** @type {(() => string | undefined) | null} */
let requestIdProvider = null;

const PII_KEY =
	/^(authorization|cookie|password|passwd|secret|token|access_token|refresh_token|id_token|api[_-]?key|email|phone|ssn|lat|lng|latitude|longitude|password_temp)$/i;

const SECRET_IN_STRING =
	/(bearer\s+[a-z0-9\-._~+/]+=*|eyJ[a-zA-Z0-9_-]+\.[a-zA-Z0-9_-]+|password\s*[:=]\s*\S+|refresh_token\s*[:=]\s*\S+)/gi;

/**
 * Registra el sink de producción (Sentry, Datadog RUM, etc.).
 * @param {((event: LogEvent) => void) | null} sink
 */
export function setObservabilitySink(sink) {
	observabilitySink = typeof sink === 'function' ? sink : null;
}

/**
 * Proveedor opcional de requestId / correlationId (p. ej. desde un store).
 * @param {(() => string | undefined) | null} provider
 */
export function setRequestIdProvider(provider) {
	requestIdProvider = typeof provider === 'function' ? provider : null;
}

/** @returns {string} */
export function createRequestId() {
	if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
		return crypto.randomUUID();
	}
	return `req_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}

/** @param {unknown} value */
export function scrubPiiString(value) {
	if (value == null) return undefined;
	const s = String(value);
	return s.replace(SECRET_IN_STRING, '[REDACTED]').slice(0, 280);
}

/**
 * @param {Record<string, unknown> | null | undefined} input
 * @returns {Record<string, string | number | boolean | null> | undefined}
 */
export function scrubContext(input) {
	if (!input || typeof input !== 'object') return undefined;
	/** @type {Record<string, string | number | boolean | null>} */
	const out = {};
	for (const [key, value] of Object.entries(input)) {
		if (PII_KEY.test(key)) {
			out[key] = '[REDACTED]';
			continue;
		}
		if (value == null) {
			out[key] = null;
			continue;
		}
		if (typeof value === 'number' || typeof value === 'boolean') {
			out[key] = value;
			continue;
		}
		if (typeof value === 'string') {
			out[key] = scrubPiiString(value) ?? '[REDACTED]';
			continue;
		}
		// No anidar objetos (pueden traer PII).
		out[key] = '[omitted]';
	}
	return out;
}

/** @param {unknown} value */
function toSafeDetail(value) {
	if (value == null || value === '') return undefined;
	if (typeof value === 'string') return scrubPiiString(value);
	if (typeof value === 'number' || typeof value === 'boolean') return String(value);
	if (value instanceof Error) return scrubPiiString(value.message);
	return undefined;
}

/**
 * @param {LogLevel} level
 * @param {string | { code?: string, message: string, err?: unknown, context?: Record<string, unknown>, requestId?: string }} messageOrEvent
 * @param {unknown} [detailOrContext]
 */
function emit(level, messageOrEvent, detailOrContext) {
	/** @type {LogEvent} */
	let event;

	if (messageOrEvent && typeof messageOrEvent === 'object' && 'message' in messageOrEvent) {
		const e = messageOrEvent;
		event = {
			level,
			message: String(e.message || 'Error'),
			code: e.code ? String(e.code) : undefined,
			requestId: e.requestId || requestIdProvider?.() || undefined,
			timestamp: new Date().toISOString(),
			detail: toSafeDetail(e.err),
			context: scrubContext(e.context)
		};
	} else {
		const message = String(messageOrEvent ?? '');
		const detail =
			detailOrContext && typeof detailOrContext === 'object' && !(detailOrContext instanceof Error)
				? undefined
				: toSafeDetail(detailOrContext);
		const context =
			detailOrContext &&
			typeof detailOrContext === 'object' &&
			!(detailOrContext instanceof Error) &&
			!Array.isArray(detailOrContext)
				? scrubContext(/** @type {Record<string, unknown>} */ (detailOrContext))
				: undefined;
		event = {
			level,
			message,
			requestId: requestIdProvider?.() || undefined,
			timestamp: new Date().toISOString(),
			detail,
			context
		};
	}

	if (isDev) {
		const prefix = event.code ? `[${event.code}]` : '';
		const rid = event.requestId ? `(${event.requestId.slice(0, 8)})` : '';
		const line = [prefix, rid, event.message].filter(Boolean).join(' ');
		const extras = [event.detail, event.context].filter((v) => v != null);
		if (extras.length) console[level](line, ...extras);
		else console[level](line);
	}

	if (observabilitySink && (level === 'error' || level === 'warn')) {
		try {
			observabilitySink(event);
		} catch {
			/* sink nunca debe romper la app */
		}
	}
}

export const logger = {
	/**
	 * @param {string | { code?: string, message: string, err?: unknown, context?: Record<string, unknown>, requestId?: string }} messageOrEvent
	 * @param {unknown} [detail]
	 */
	debug(messageOrEvent, detail) {
		emit('debug', messageOrEvent, detail);
	},
	/**
	 * @param {string | { code?: string, message: string, err?: unknown, context?: Record<string, unknown>, requestId?: string }} messageOrEvent
	 * @param {unknown} [detail]
	 */
	info(messageOrEvent, detail) {
		emit('info', messageOrEvent, detail);
	},
	/**
	 * @param {string | { code?: string, message: string, err?: unknown, context?: Record<string, unknown>, requestId?: string }} messageOrEvent
	 * @param {unknown} [detail]
	 */
	warn(messageOrEvent, detail) {
		emit('warn', messageOrEvent, detail);
	},
	/**
	 * @param {string | { code?: string, message: string, err?: unknown, context?: Record<string, unknown>, requestId?: string }} messageOrEvent
	 * @param {unknown} [detail]
	 */
	error(messageOrEvent, detail) {
		emit('error', messageOrEvent, detail);
	}
};
