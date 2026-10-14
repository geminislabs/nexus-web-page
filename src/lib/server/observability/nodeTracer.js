/**
 * El tracer de Node para el servidor de SvelteKit.
 *
 * Vive en `$lib/server` para que el cliente no pueda importarlo: así ni sus
 * `import()` ni `@opentelemetry/instrumentation-http` (que arrastra
 * `forwarded-parse` y `util` de Node) entran al build del navegador.
 * `hooks.server.js` lo inyecta en `init({ serverTracer })`.
 */
import { ScrubSpanProcessor } from '$lib/observability/init.js';

export async function initNodeTracer(resource, base) {
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
