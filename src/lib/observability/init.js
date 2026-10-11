import { metrics, trace } from '@opentelemetry/api';
import { logs } from '@opentelemetry/api-logs';
import { scrubAttrs, scrubUrl } from './scrubber.js';

const SERVICE = 'nexus-web-page';

let started = false;

function readConst(value, fallback) {
	if (value == null) return fallback;
	const text = String(value).trim();
	return text === '' ? fallback : text;
}

function readDeployEnv() {
	if (typeof process !== 'undefined' && process.env?.DEPLOY_ENV) {
		const env = String(process.env.DEPLOY_ENV).trim();
		if (env === 'production' || env === 'test' || env === 'local') return env;
	}
	const defined = typeof __DEPLOY_ENV__ !== 'undefined' ? String(__DEPLOY_ENV__).trim() : '';
	if (defined === 'production' || defined === 'test' || defined === 'local') return defined;
	return 'local';
}

function isDevCollectorDefault(url) {
	return url === 'http://localhost:4318' || url === 'http://127.0.0.1:4318';
}

function readOtlpEndpoint() {
	if (typeof process !== 'undefined' && process.env && 'OTLP_ENDPOINT' in process.env) {
		return String(process.env.OTLP_ENDPOINT || '').trim();
	}
	const nodeEnv = typeof process !== 'undefined' ? String(process.env?.NODE_ENV || '') : '';
	let baked = '';
	if (typeof __OTLP_ENDPOINT__ !== 'undefined') {
		baked = String(__OTLP_ENDPOINT__).trim();
	}
	// `process.env.NODE_ENV` no siempre sobrevive al bundle del navegador.
	// `import.meta.env.PROD` sí: un preview o un build de producción sin
	// endpoint se queda en silencio y la app hidrata.
	if (import.meta.env.PROD || nodeEnv === 'production') {
		if (baked && !isDevCollectorDefault(baked)) return baked;
		return '';
	}
	if (baked) return baked;
	const vitest = typeof process !== 'undefined' && Boolean(process.env?.VITEST);
	if (!vitest && readDeployEnv() === 'local') return 'http://localhost:4318';
	return '';
}

function readServiceName() {
	return readConst(
		typeof __SERVICE_NAME__ !== 'undefined' ? __SERVICE_NAME__ : '',
		'nexus-web-page'
	);
}

function readServiceVersion() {
	return readConst(typeof __SERVICE_VERSION__ !== 'undefined' ? __SERVICE_VERSION__ : '', '0.0.0');
}

function exporterBase(rawEndpoint) {
	if (typeof window !== 'undefined') return '/internal/otlp';
	return String(rawEndpoint || '').replace(/\/$/, '');
}

function hostnameFrom(raw) {
	try {
		const text = String(raw || '').trim();
		if (!text) return '';
		return new URL(text).hostname;
	} catch {
		return '';
	}
}

/**
 * Hosts a los que el browser puede mandar `traceparent`.
 * localhost, loopback y los de VITE_API_BASE_URL / VITE_COMM_API_URL.
 */
function traceHeaderCorsUrls() {
	const patterns = [/localhost/, /127\.0\.0\.1/];
	let raws = [];
	try {
		if (typeof import.meta !== 'undefined' && import.meta.env) {
			raws = [import.meta.env.VITE_API_BASE_URL, import.meta.env.VITE_COMM_API_URL];
		}
	} catch {
		raws = [];
	}
	for (const raw of raws) {
		const host = hostnameFrom(raw);
		if (!host || host === 'localhost' || host === '127.0.0.1') continue;
		const escaped = host.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
		patterns.push(new RegExp(escaped));
	}
	return patterns;
}

function scrubSpanAttributes(span) {
	try {
		const attrs = span?.attributes;
		if (!attrs || typeof attrs !== 'object') return;
		const scrubbed = scrubAttrs(attrs);
		for (const key of Object.keys(attrs)) {
			let next = Object.prototype.hasOwnProperty.call(scrubbed, key) ? scrubbed[key] : attrs[key];
			if (typeof next === 'string' && next.includes('?')) next = scrubUrl(next);
			if (typeof span.setAttribute === 'function') {
				span.setAttribute(key, next);
			} else {
				attrs[key] = next;
			}
		}
	} catch {
		/* fail-open */
	}
}

/**
 * Recorta atributos del span antes de exportar.
 * @param {{ onStart?: Function, onEnd?: Function, onEnding?: Function, forceFlush?: Function, shutdown?: Function }} next
 */
export class ScrubSpanProcessor {
	constructor(next) {
		this._next = next;
	}

	onStart(span, parentContext) {
		try {
			this._next?.onStart?.(span, parentContext);
		} catch {
			/* fail-open */
		}
	}

	onEnding(span) {
		scrubSpanAttributes(span);
		try {
			this._next?.onEnding?.(span);
		} catch {
			/* fail-open */
		}
	}

	onEnd(span) {
		scrubSpanAttributes(span);
		try {
			this._next?.onEnd?.(span);
		} catch {
			/* fail-open */
		}
	}

	forceFlush() {
		try {
			return Promise.resolve(this._next?.forceFlush?.()).then(() => undefined);
		} catch {
			return Promise.resolve();
		}
	}

	shutdown() {
		try {
			return Promise.resolve(this._next?.shutdown?.()).then(() => undefined);
		} catch {
			return Promise.resolve();
		}
	}
}

async function buildResource() {
	const { resourceFromAttributes } = await import('@opentelemetry/resources');
	const { ATTR_SERVICE_NAME, ATTR_SERVICE_VERSION } =
		await import('@opentelemetry/semantic-conventions');
	return resourceFromAttributes({
		[ATTR_SERVICE_NAME]: readServiceName(),
		[ATTR_SERVICE_VERSION]: readServiceVersion(),
		'deployment.environment': readDeployEnv()
	});
}

const DURATION_BINS = [5, 10, 25, 50, 75, 100, 250, 500, 750, 1000, 2500, 5000, 7500, 10000];

async function registerMeterAndLogger(resource, base) {
	const [
		{ MeterProvider, PeriodicExportingMetricReader, AggregationType, InstrumentType },
		{ AggregationTemporalityPreference, OTLPMetricExporter }
	] = await Promise.all([
		import('@opentelemetry/sdk-metrics'),
		import('@opentelemetry/exporter-metrics-otlp-http')
	]);
	const histogramAggregation = {
		type: AggregationType.EXPLICIT_BUCKET_HISTOGRAM,
		options: { boundaries: DURATION_BINS }
	};
	const meterProvider = new MeterProvider({
		resource,
		views: [
			{
				instrumentType: InstrumentType.HISTOGRAM,
				instrumentName: 'http_server_duration_milliseconds',
				aggregation: histogramAggregation
			},
			{
				instrumentType: InstrumentType.HISTOGRAM,
				instrumentName: 'http_client_duration_milliseconds',
				aggregation: histogramAggregation
			}
		],
		readers: [
			new PeriodicExportingMetricReader({
				exporter: new OTLPMetricExporter({
					url: `${base}/v1/metrics`,
					temporalityPreference: AggregationTemporalityPreference.CUMULATIVE
				}),
				exportIntervalMillis: 5000
			})
		]
	});
	metrics.setGlobalMeterProvider(meterProvider);

	const [{ LoggerProvider, BatchLogRecordProcessor }, { OTLPLogExporter }] = await Promise.all([
		import('@opentelemetry/sdk-logs'),
		import('@opentelemetry/exporter-logs-otlp-http')
	]);
	const loggerProvider = new LoggerProvider({
		resource,
		processors: [new BatchLogRecordProcessor(new OTLPLogExporter({ url: `${base}/v1/logs` }))]
	});
	logs.setGlobalLoggerProvider(loggerProvider);
}

async function initBrowserTracer(resource, base) {
	const [
		{ WebTracerProvider, StackContextManager, BatchSpanProcessor },
		{ W3CTraceContextPropagator },
		{ OTLPTraceExporter },
		{ registerInstrumentations },
		{ FetchInstrumentation }
	] = await Promise.all([
		import('@opentelemetry/sdk-trace-web'),
		import('@opentelemetry/core'),
		import('@opentelemetry/exporter-trace-otlp-http'),
		import('@opentelemetry/instrumentation'),
		import('@opentelemetry/instrumentation-fetch')
	]);

	const processor = new ScrubSpanProcessor(
		new BatchSpanProcessor(new OTLPTraceExporter({ url: `${base}/v1/traces` }))
	);
	const provider = new WebTracerProvider({
		resource,
		spanProcessors: [processor]
	});
	provider.register({
		contextManager: new StackContextManager(),
		propagator: new W3CTraceContextPropagator()
	});
	registerInstrumentations({
		tracerProvider: provider,
		instrumentations: [
			new FetchInstrumentation({
				ignoreUrls: [/\/internal\/otlp/],
				// Propaga W3C traceparent a requests cross-origin para tracing distribuido.
				// Sin esto el browser OTel SDK no inyecta el header en otros orígenes.
				propagateTraceHeaderCorsUrls: traceHeaderCorsUrls()
			})
		]
	});
}

async function initNodeTracer(resource, base) {
	const [
		{ NodeTracerProvider, BatchSpanProcessor },
		{ AsyncLocalStorageContextManager },
		{ W3CTraceContextPropagator },
		{ OTLPTraceExporter },
		{ registerInstrumentations },
		{ HttpInstrumentation }
	] = await Promise.all([
		import('@opentelemetry/sdk-trace-node'),
		import('@opentelemetry/context-async-hooks'),
		import('@opentelemetry/core'),
		import('@opentelemetry/exporter-trace-otlp-http'),
		import('@opentelemetry/instrumentation'),
		import('@opentelemetry/instrumentation-http')
	]);

	const processor = new ScrubSpanProcessor(
		new BatchSpanProcessor(new OTLPTraceExporter({ url: `${base}/v1/traces` }))
	);
	const provider = new NodeTracerProvider({
		resource,
		spanProcessors: [processor]
	});
	provider.register({
		contextManager: new AsyncLocalStorageContextManager(),
		propagator: new W3CTraceContextPropagator()
	});
	registerInstrumentations({
		tracerProvider: provider,
		instrumentations: [
			new HttpInstrumentation({
				disableOutgoingRequestInstrumentation: true,
				ignoreIncomingRequestHook(request) {
					const url = String(request?.url || '');
					return (
						url.includes('/internal/otlp') ||
						url.includes('/v1/metrics') ||
						url.includes('/v1/traces') ||
						url.includes('/v1/logs')
					);
				}
			})
		]
	});
}

/**
 * Inicializa providers OTel. Sin endpoint: no-op (API global ya es no-op).
 */
export async function init() {
	if (started) return;
	try {
		const endpoint = readOtlpEndpoint();
		if (!endpoint) return;
		started = true;
		const resource = await buildResource();
		const base = exporterBase(endpoint);
		await registerMeterAndLogger(resource, base);
		try {
			if (import.meta.env.SSR) {
				await initNodeTracer(resource, base);
			} else {
				await initBrowserTracer(resource, base);
			}
		} catch (error) {
			console.error('[observability] tracer init failed', error);
		}
	} catch (error) {
		started = false;
		console.error('[observability] init failed', error);
	}
}

export function tracer() {
	return trace.getTracer(SERVICE);
}

export function meter() {
	return metrics.getMeter(SERVICE);
}

export function otelLogger() {
	return logs.getLogger(SERVICE);
}
