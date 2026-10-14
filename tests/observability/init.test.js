import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { metrics, trace } from '@opentelemetry/api';
import { logs } from '@opentelemetry/api-logs';

const {
	WebTracerProvider,
	NodeTracerProvider,
	BatchSpanProcessor,
	MeterProvider,
	PeriodicExportingMetricReader,
	LoggerProvider,
	BatchLogRecordProcessor,
	OTLPTraceExporter,
	OTLPMetricExporter,
	OTLPLogExporter,
	registerInstrumentations,
	FetchInstrumentation,
	HttpInstrumentation,
	resourceFromAttributes
} = vi.hoisted(() => {
	function ctor() {
		this.register = vi.fn();
	}
	return {
		WebTracerProvider: vi.fn(ctor),
		NodeTracerProvider: vi.fn(ctor),
		BatchSpanProcessor: vi.fn(function BatchSpanProcessor() {}),
		MeterProvider: vi.fn(function MeterProvider() {
			this.getMeter = () => ({ createCounter: () => ({ add: vi.fn() }) });
		}),
		PeriodicExportingMetricReader: vi.fn(function PeriodicExportingMetricReader() {}),
		LoggerProvider: vi.fn(function LoggerProvider() {
			this.getLogger = () => ({ emit: vi.fn() });
		}),
		BatchLogRecordProcessor: vi.fn(function BatchLogRecordProcessor() {}),
		OTLPTraceExporter: vi.fn(function OTLPTraceExporter() {}),
		OTLPMetricExporter: vi.fn(function OTLPMetricExporter() {}),
		OTLPLogExporter: vi.fn(function OTLPLogExporter() {}),
		registerInstrumentations: vi.fn(),
		FetchInstrumentation: vi.fn(function FetchInstrumentation() {}),
		HttpInstrumentation: vi.fn(function HttpInstrumentation() {}),
		resourceFromAttributes: vi.fn(() => ({ service: 'test' }))
	};
});

vi.mock('@opentelemetry/sdk-trace-web', () => ({
	WebTracerProvider,
	StackContextManager: class StackContextManager {},
	BatchSpanProcessor
}));
vi.mock('@opentelemetry/sdk-trace-node', () => ({
	NodeTracerProvider,
	BatchSpanProcessor
}));
vi.mock('@opentelemetry/sdk-metrics', () => ({
	MeterProvider,
	PeriodicExportingMetricReader,
	AggregationType: { DEFAULT: 0, EXPLICIT_BUCKET_HISTOGRAM: 4 },
	InstrumentType: { HISTOGRAM: 'HISTOGRAM' }
}));
vi.mock('@opentelemetry/sdk-logs', () => ({
	LoggerProvider,
	BatchLogRecordProcessor
}));
vi.mock('@opentelemetry/exporter-trace-otlp-http', () => ({ OTLPTraceExporter }));
vi.mock('@opentelemetry/exporter-metrics-otlp-http', () => ({
	OTLPMetricExporter,
	AggregationTemporalityPreference: { DELTA: 0, CUMULATIVE: 1, LOWMEMORY: 2 }
}));
vi.mock('@opentelemetry/exporter-logs-otlp-http', () => ({ OTLPLogExporter }));
vi.mock('@opentelemetry/instrumentation', () => ({ registerInstrumentations }));
vi.mock('@opentelemetry/instrumentation-fetch', () => ({ FetchInstrumentation }));
vi.mock('@opentelemetry/instrumentation-http', () => ({ HttpInstrumentation }));
vi.mock('@opentelemetry/core', () => ({
	W3CTraceContextPropagator: class W3CTraceContextPropagator {}
}));
vi.mock('@opentelemetry/context-async-hooks', () => ({
	AsyncLocalStorageContextManager: class AsyncLocalStorageContextManager {}
}));
vi.mock('@opentelemetry/resources', () => ({ resourceFromAttributes }));
vi.mock('@opentelemetry/semantic-conventions', () => ({
	ATTR_SERVICE_NAME: 'service.name',
	ATTR_SERVICE_VERSION: 'service.version'
}));

describe('init', () => {
	afterEach(() => {
		vi.useRealTimers();
		vi.unstubAllEnvs();
		vi.resetModules();
		vi.clearAllMocks();
		try {
			metrics.disable();
			trace.disable();
			logs.disable();
		} catch {
			/* restore no-op API */
		}
	});

	it('produccion sin OTLP_ENDPOINT no registra exporters', async () => {
		const had = Object.prototype.hasOwnProperty.call(process.env, 'OTLP_ENDPOINT');
		const previous = process.env.OTLP_ENDPOINT;
		delete process.env.OTLP_ENDPOINT;
		vi.stubEnv('NODE_ENV', 'production');
		try {
			const { init } = await import('../../src/lib/observability/init.js');
			await expect(init()).resolves.toBeUndefined();
			expect(WebTracerProvider).not.toHaveBeenCalled();
			expect(NodeTracerProvider).not.toHaveBeenCalled();
			expect(OTLPTraceExporter).not.toHaveBeenCalled();
		} finally {
			if (had) process.env.OTLP_ENDPOINT = previous;
		}
	});

	it('sin endpoint no registra exporters', async () => {
		vi.stubEnv('OTLP_ENDPOINT', '');
		const { init } = await import('../../src/lib/observability/init.js');
		await expect(init()).resolves.toBeUndefined();
		expect(WebTracerProvider).not.toHaveBeenCalled();
		expect(NodeTracerProvider).not.toHaveBeenCalled();
		expect(OTLPTraceExporter).not.toHaveBeenCalled();
	});

	it('segunda llamada no-op', async () => {
		vi.stubEnv('OTLP_ENDPOINT', '');
		const { init } = await import('../../src/lib/observability/init.js');
		await init();
		await init();
		expect(WebTracerProvider).not.toHaveBeenCalled();
	});

	it('con endpoint en browser registra providers y no throw', async () => {
		vi.stubEnv('OTLP_ENDPOINT', 'http://localhost:4318');
		const { init } = await import('../../src/lib/observability/init.js');
		await expect(init()).resolves.toBeUndefined();
		expect(WebTracerProvider).toHaveBeenCalled();
		expect(OTLPTraceExporter).toHaveBeenCalled();
		expect(registerInstrumentations).toHaveBeenCalled();
		expect(FetchInstrumentation).toHaveBeenCalledWith(
			expect.objectContaining({
				ignoreUrls: expect.arrayContaining([expect.any(RegExp)]),
				propagateTraceHeaderCorsUrls: expect.arrayContaining([
					expect.any(RegExp),
					expect.any(RegExp)
				])
			})
		);
		const cors = FetchInstrumentation.mock.calls[0][0].propagateTraceHeaderCorsUrls;
		expect(cors.some((pattern) => pattern.test('http://localhost:8100'))).toBe(true);
		expect(cors.some((pattern) => pattern.test('http://127.0.0.1:8000'))).toBe(true);
		expect(
			FetchInstrumentation.mock.calls[0][0].ignoreUrls.some((pattern) =>
				pattern.test('/internal/otlp/v1/traces')
			)
		).toBe(true);
		expect(MeterProvider).toHaveBeenCalled();
		expect(MeterProvider.mock.calls[0][0]).toEqual(
			expect.objectContaining({
				views: expect.arrayContaining([
					expect.objectContaining({ instrumentName: 'http_server_duration_milliseconds' }),
					expect.objectContaining({ instrumentName: 'http_client_duration_milliseconds' })
				])
			})
		);
		expect(LoggerProvider).toHaveBeenCalled();
		expect(NodeTracerProvider).not.toHaveBeenCalled();
	});

	it.skipIf(!import.meta.env.SSR)('con endpoint en Node registra NodeTracerProvider', async () => {
		vi.stubEnv('OTLP_ENDPOINT', 'http://localhost:4318');
		const { init } = await import('../../src/lib/observability/init.js');
		const { initNodeTracer } = await import('../../src/lib/server/observability/nodeTracer.js');
		await expect(init({ serverTracer: initNodeTracer })).resolves.toBeUndefined();
		expect(NodeTracerProvider).toHaveBeenCalled();
		expect(HttpInstrumentation).toHaveBeenCalledWith(
			expect.objectContaining({ disableOutgoingRequestInstrumentation: true })
		);
		expect(WebTracerProvider).not.toHaveBeenCalled();
	});

	it('si el tracer throw, igual registra MeterProvider', async () => {
		vi.stubEnv('OTLP_ENDPOINT', 'http://localhost:4318');
		vi.spyOn(console, 'error').mockImplementation(() => {});
		WebTracerProvider.mockImplementationOnce(() => {
			throw new Error('cjs');
		});
		const { init } = await import('../../src/lib/observability/init.js');
		await expect(init()).resolves.toBeUndefined();
		expect(MeterProvider).toHaveBeenCalled();
	});

	it('fail-open si el SDK throw', async () => {
		vi.stubEnv('OTLP_ENDPOINT', 'http://localhost:4318');
		resourceFromAttributes.mockImplementationOnce(() => {
			throw new Error('resource boom');
		});
		const { init } = await import('../../src/lib/observability/init.js');
		await expect(init()).resolves.toBeUndefined();
	});

	it('tracer, meter y otelLogger no throw', async () => {
		const { tracer, meter, otelLogger } = await import('../../src/lib/observability/init.js');
		expect(typeof tracer).toBe('function');
		expect(typeof meter).toBe('function');
		expect(typeof otelLogger).toBe('function');
		expect(() => tracer()).not.toThrow();
		expect(() => meter()).not.toThrow();
		expect(() => otelLogger()).not.toThrow();
	});
});

describe('el tracer de Node no entra al bundle del cliente', () => {
	it('init.js no importa el SDK de Node ni la instrumentación HTTP', async () => {
		// Con estos import() en init.js, Rollup los empaquetaba como chunks del
		// cliente aunque la rama SSR se eliminara: ~32 KB huérfanos y el aviso
		// «Module "util" has been externalized» de forwarded-parse en cada build.
		const { readFileSync } = await import('node:fs');
		const { resolve } = await import('node:path');
		const fuente = readFileSync(resolve(process.cwd(), 'src/lib/observability/init.js'), 'utf8');
		for (const paquete of [
			'@opentelemetry/sdk-trace-node',
			'@opentelemetry/instrumentation-http',
			'@opentelemetry/context-async-hooks'
		]) {
			expect(fuente).not.toContain(paquete);
		}
	});
});

describe('ScrubSpanProcessor', () => {
	beforeEach(async () => {
		vi.resetModules();
	});

	it('onEnd redacta keys prohibidas y query en URLs', async () => {
		const { ScrubSpanProcessor } = await import('../../src/lib/observability/init.js');
		const attrs = {
			password: 'secret',
			'http.method': 'GET',
			'http.url': '/verify-email?token=SECRET'
		};
		const setAttribute = vi.fn((key, value) => {
			attrs[key] = value;
		});
		const next = {
			onStart: vi.fn(),
			onEnd: vi.fn(),
			onEnding: vi.fn(),
			forceFlush: vi.fn(async () => {}),
			shutdown: vi.fn(async () => {})
		};
		const processor = new ScrubSpanProcessor(next);
		const span = { attributes: attrs, setAttribute };
		processor.onStart(span, {});
		processor.onEnding(span);
		processor.onEnd(span);
		expect(attrs.password).toBe('[REDACTED]');
		expect(attrs['http.method']).toBe('GET');
		expect(attrs['http.url']).toBe('/verify-email');
		expect(JSON.stringify(attrs)).not.toContain('SECRET');
		expect(next.onStart).toHaveBeenCalled();
		expect(next.onEnd).toHaveBeenCalled();
		expect(next.onEnding).toHaveBeenCalled();
		await expect(processor.forceFlush()).resolves.toBeUndefined();
		await expect(processor.shutdown()).resolves.toBeUndefined();
	});

	it('fail-open si next throw o attributes inválidos', async () => {
		const { ScrubSpanProcessor } = await import('../../src/lib/observability/init.js');
		const next = {
			onStart() {
				throw new Error('start');
			},
			onEnd() {
				throw new Error('end');
			},
			onEnding() {
				throw new Error('ending');
			},
			forceFlush() {
				throw new Error('flush');
			},
			shutdown() {
				throw new Error('down');
			}
		};
		const processor = new ScrubSpanProcessor(next);
		expect(() => processor.onStart({}, {})).not.toThrow();
		expect(() => processor.onEnding({})).not.toThrow();
		expect(() => processor.onEnd(null)).not.toThrow();
		await expect(processor.forceFlush()).resolves.toBeUndefined();
		await expect(processor.shutdown()).resolves.toBeUndefined();
	});

	it('muta attributes si no hay setAttribute', async () => {
		const { ScrubSpanProcessor } = await import('../../src/lib/observability/init.js');
		const attrs = { token: 'abc', ok: 1 };
		const processor = new ScrubSpanProcessor({ onEnd() {} });
		processor.onEnd({ attributes: attrs });
		expect(attrs.token).toBe('[REDACTED]');
		expect(attrs.ok).toBe(1);
	});
});
