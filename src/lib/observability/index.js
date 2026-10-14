/**
 * Puente logger → logs OTLP.
 * `logger.warn` / `logger.error` ya salen scrubbed; este sink los reenvía.
 * Sin endpoint el exporter no arranca y el sink falla abierto.
 */

import { setObservabilitySink, setRequestIdProvider, createRequestId } from '$lib/utils/logger.js';
import { logError, logWarn } from './capture.js';
import { init as initTelemetry } from './init.js';

let bridgeReady = false;

function registerLoggerSink() {
	if (bridgeReady) return;
	bridgeReady = true;

	const pageRequestId = createRequestId();
	setRequestIdProvider(() => pageRequestId);

	setObservabilitySink((event) => {
		const attrs = {};
		if (event?.code) attrs.code = event.code;
		if (event?.requestId) attrs.request_id = event.requestId;
		if (event?.detail) attrs.detail = event.detail;
		if (event?.context && typeof event.context === 'object') {
			Object.assign(attrs, event.context);
		}
		const message = event?.message ?? '';
		if (event?.level === 'warn') logWarn(message, attrs);
		else logError(message, attrs);
	});
}

/**
 * Inicializa OTel y registra el sink del logger.
 * Seguro llamar más de una vez. Sin `OTLP_ENDPOINT` la telemetría es no-op.
 */
export async function init(options) {
	try {
		registerLoggerSink();
	} catch {
		/* fail-open */
	}
	await initTelemetry(options);
}

/** El layout ya llama este nombre. Hace lo mismo que `init()`. */
export function initObservability() {
	return init();
}

export { setObservabilitySink, setRequestIdProvider, createRequestId };
