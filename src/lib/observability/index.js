/**
 * Punto de enganche para observability (Sentry, Datadog RUM, etc.).
 * Hoy no envía nada: cuando el stack esté listo, configurar el sink aquí
 * sin tocar los call sites de logger.*.
 *
 * Ejemplo futuro:
 *   import * as Sentry from '@sentry/sveltekit';
 *   setObservabilitySink((event) => {
 *     Sentry.captureMessage(event.message, {
 *       level: event.level,
 *       tags: { code: event.code, requestId: event.requestId },
 *       extra: { detail: event.detail, context: event.context }
 *     });
 *   });
 */

import { setObservabilitySink, setRequestIdProvider, createRequestId } from '$lib/utils/logger.js';

let initialized = false;

/** Correlation id de la sesión de página (no PII). */
let pageRequestId = '';

/**
 * Inicializa el puente logger → observability.
 * Seguro llamar más de una vez; no-op hasta registrar un sink real.
 */
export function initObservability() {
	if (initialized) return;
	initialized = true;

	pageRequestId = createRequestId();
	setRequestIdProvider(() => pageRequestId);

	// Sink null = solo DEV console vía logger. Sustituir cuando exista el proveedor.
	setObservabilitySink(null);
}

export { setObservabilitySink, setRequestIdProvider, createRequestId };
