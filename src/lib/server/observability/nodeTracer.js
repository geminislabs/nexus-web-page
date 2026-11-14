/**
 * El tracer de Node para el servidor de SvelteKit.
 *
 * Vive en `$lib/server` para que el cliente no pueda importarlo: así ni sus
 * `import()` ni `@opentelemetry/instrumentation-http` (que arrastra
 * `forwarded-parse` y `util` de Node) entran al build del navegador.
 * `hooks.server.js` lo inyecta en `init({ serverTracer })`.
 */
import { ScrubSpanProcessor, registerTracerProvider } from '$lib/observability/init.js';

export async function initNodeTracer(resource, base) {
	const [
		{ TracerProvider, BatchSpanProcessor },
		{ AsyncLocalStorageContextManager },
		{ W3CTraceContextPropagator },
		{ OTLPTraceExporter },
		{ registerInstrumentations },
		{ HttpInstrumentation }
	] = await Promise.all([
		import('@opentelemetry/sdk-trace'),
		import('@opentelemetry/context-async-hooks'),
		import('@opentelemetry/core'),
		import('@opentelemetry/exporter-trace-otlp-http'),
		import('@opentelemetry/instrumentation'),
		import('@opentelemetry/instrumentation-http')
	]);

	const processor = new ScrubSpanProcessor(
		new BatchSpanProcessor({ exporter: new OTLPTraceExporter({ url: `${base}/v1/traces` }) })
	);
	const provider = new TracerProvider({
		resource,
		spanProcessors: [processor]
	});
	registerTracerProvider(
		provider,
		new AsyncLocalStorageContextManager(),
		new W3CTraceContextPropagator()
	);
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
