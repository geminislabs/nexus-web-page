import { logs, SeverityNumber } from '@opentelemetry/api-logs';
import { recordJsError } from './journey.js';
import { scrubAttrs, scrubMessage, scrubStack } from './scrubber.js';

const SERVICE = 'nexus-web-page';
const seen = typeof WeakSet === 'function' ? new WeakSet() : null;
let browserInstalled = false;
let nodeInstalled = false;

/**
 * @param {unknown} error
 * @returns {string}
 */
export function classifyError(error) {
	const name = error && typeof error === 'object' && 'name' in error ? String(error.name) : '';
	if (name === 'AbortError' || name === 'TimeoutError') return 'timeout';
	if (name === 'TypeError' || name === 'ReferenceError' || name === 'SyntaxError') {
		return 'programming';
	}
	return 'programming';
}

/**
 * @param {number} severityNumber
 * @param {string} severityText
 * @param {unknown} message
 * @param {Record<string, unknown>} [attrs]
 */
function emitLog(severityNumber, severityText, message, attrs) {
	try {
		logs.getLogger(SERVICE).emit({
			severityNumber,
			severityText,
			body: scrubMessage(message),
			attributes: scrubAttrs(attrs ?? {})
		});
	} catch {
		/* fail-open */
	}
}

/**
 * @param {unknown} message
 * @param {Record<string, unknown>} [attrs]
 */
export function logWarn(message, attrs) {
	emitLog(SeverityNumber.WARN, 'WARN', message, attrs);
}

/**
 * @param {unknown} message
 * @param {Record<string, unknown>} [attrs]
 */
export function logError(message, attrs) {
	emitLog(SeverityNumber.ERROR, 'ERROR', message, attrs);
}

/**
 * @param {unknown} error
 * @param {string} [_source]
 */
export function reportUnhandled(error) {
	try {
		if (error && typeof error === 'object' && seen) {
			if (seen.has(error)) return;
			seen.add(error);
		}
		const category = classifyError(error);
		const rawMessage =
			error instanceof Error ? error.message : error != null ? String(error) : 'unhandled error';
		const rawStack = error instanceof Error && error.stack ? error.stack : '';
		/** @type {Record<string, unknown>} */
		const attrs = { error_category: category };
		if (rawStack) attrs.stack = scrubStack(rawStack);
		logError(rawMessage, attrs);
		recordJsError({ errorCategory: category });
	} catch {
		/* fail-open */
	}
}

export function installBrowserErrorCapture() {
	if (browserInstalled || typeof window === 'undefined') return;
	browserInstalled = true;

	const onError = (event) => {
		const err = event instanceof ErrorEvent ? event.error || event.message : event;
		reportUnhandled(err, 'browser');
	};
	const onRejection = (event) => {
		reportUnhandled(event?.reason ?? event, 'browser');
	};

	window.addEventListener('error', onError);
	window.addEventListener('unhandledrejection', onRejection);
	window.onerror = function onWindowError(message, _source, _lineno, _colno, error) {
		reportUnhandled(error || message, 'browser');
		return false;
	};
}

/**
 * Captura de errores del proceso Node.
 *
 * Registrar un listener de `uncaughtException` **anula** el comportamiento por
 * defecto de Node, que es imprimir el stack y morir. Lo mismo hace un listener
 * de `unhandledRejection` con el modo `throw` que Node trae desde la v15.
 *
 * Sin volver a matar el proceso a mano, el servidor sobrevive a una excepcion
 * no capturada y sigue atendiendo peticiones con estado indefinido. Es peor que
 * el fallo original: un proceso muerto lo reinicia el contenedor; uno a medias
 * no se reinicia y nadie se entera hasta que alguien mira.
 *
 * Por eso reportamos y devolvemos el comportamiento original.
 */
export function installNodeErrorCapture() {
	if (nodeInstalled || typeof process === 'undefined' || typeof process.on !== 'function') return;
	nodeInstalled = true;
	process.on('uncaughtException', (error) => {
		reportUnhandled(error, 'node');
		// Replica lo que hacia el default antes de que este listener existiera:
		// el stack a stderr, y morir con codigo 1 para que el contenedor reinicie.
		console.error(error);
		process.exit(1);
	});
	process.on('unhandledRejection', (reason) => {
		reportUnhandled(reason, 'node');
		// Volver a lanzar la convierte en uncaughtException, que es exactamente
		// lo que Node hace por su cuenta cuando nadie escucha este evento.
		throw reason instanceof Error ? reason : new Error(String(reason));
	});
}
