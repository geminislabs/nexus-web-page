import { context, metrics, SpanStatusCode, trace } from '@opentelemetry/api';
import { resourceMetricAttrs } from './http.js';

const SERVICE = 'nexus-web-page';
const OUTCOMES = new Set(['success', 'failure', 'cancelled', 'timeout']);

/**
 * Journey en curso. **Solo se registra en el browser**: en SSR este módulo lo
 * comparten todas las peticiones a la vez, así que guardarlo aquí haría que una
 * viera el journey de otra.
 * @type {{ name: string, traceId: string, spanId: string } | null}
 */
let activeJourney = null;

function enElBrowser() {
	return typeof window !== 'undefined';
}

function noopHandle() {
	return {
		traceId: '',
		spanId: '',
		end() {}
	};
}

/**
 * @param {unknown} outcome
 */
function normalizeOutcome(outcome) {
	const text = typeof outcome === 'string' ? outcome : '';
	return OUTCOMES.has(text) ? text : 'failure';
}

/**
 * @param {{ journey?: string, outcome?: string, errorCategory?: string }} [input]
 */
export function recordJourneyOutcome(input = {}) {
	try {
		const labels = {
			...resourceMetricAttrs(),
			journey: typeof input.journey === 'string' && input.journey ? input.journey : 'unknown',
			outcome: normalizeOutcome(input.outcome),
			error_category: typeof input.errorCategory === 'string' ? input.errorCategory : ''
		};
		metrics.getMeter(SERVICE).createCounter('journey_outcome_total').add(1, labels);
	} catch {
		/* fail-open */
	}
}

/**
 * @param {{ errorCategory?: string }} [input]
 */
export function recordJsError(input = {}) {
	try {
		metrics
			.getMeter(SERVICE)
			.createCounter('js_errors_total')
			.add(1, {
				...resourceMetricAttrs(),
				error_category:
					typeof input.errorCategory === 'string' ? input.errorCategory : 'programming'
			});
	} catch {
		/* fail-open */
	}
}

/**
 * @param {string} name
 * @param {{ traceId?: string, spanId?: string, traceFlags?: number } | null} [parentContext]
 */
export function startJourney(name, parentContext) {
	try {
		const journeyName = typeof name === 'string' && name.trim() ? name.trim() : 'unknown';
		const tracerApi = trace.getTracer(SERVICE);
		let ctx = context.active();
		if (parentContext && typeof parentContext === 'object' && parentContext.traceId) {
			ctx = trace.setSpanContext(ctx, {
				traceId: parentContext.traceId,
				spanId: parentContext.spanId || '0'.repeat(16),
				traceFlags: parentContext.traceFlags ?? 1,
				isRemote: true
			});
		}
		const span = tracerApi.startSpan(journeyName, undefined, ctx);
		const spanContext = span.spanContext();
		const traceId = spanContext?.traceId || '';
		const spanId = spanContext?.spanId || '';
		if (enElBrowser()) activeJourney = { name: journeyName, traceId, spanId };
		let ended = false;

		return {
			traceId,
			spanId,
			/**
			 * @param {string} [outcome]
			 * @param {{ error_category?: string }} [errorAttrs]
			 */
			end(outcome, errorAttrs) {
				if (ended) return;
				ended = true;
				try {
					const normalized = normalizeOutcome(outcome);
					const errorCategory =
						errorAttrs && typeof errorAttrs.error_category === 'string'
							? errorAttrs.error_category
							: undefined;
					recordJourneyOutcome({
						journey: journeyName,
						outcome: normalized,
						errorCategory
					});
					if (typeof span.setAttribute === 'function') {
						span.setAttribute('outcome', normalized);
						if (errorCategory) span.setAttribute('error_category', errorCategory);
					}
					if (normalized !== 'success' && typeof span.setStatus === 'function') {
						span.setStatus({ code: SpanStatusCode.ERROR });
					}
					span.end();
				} catch {
					/* fail-open */
				} finally {
					if (activeJourney?.spanId === spanId) activeJourney = null;
				}
			}
		};
	} catch {
		return noopHandle();
	}
}

export function getCurrentJourneyContext() {
	if (!enElBrowser()) return null;
	return activeJourney ? { ...activeJourney } : null;
}
