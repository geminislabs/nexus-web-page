import { metrics } from '@opentelemetry/api';
import { scrubUrl } from './scrubber.js';

const SERVICE = 'nexus-web-page';

const DURATION_BINS = [5, 10, 25, 50, 75, 100, 250, 500, 750, 1000, 2500, 5000, 7500, 10000];

function getMeter() {
	return metrics.getMeter(SERVICE);
}

export function resourceMetricAttrs() {
	let env = 'local';
	if (typeof process !== 'undefined' && process.env?.DEPLOY_ENV) {
		const value = String(process.env.DEPLOY_ENV).trim();
		if (value === 'production' || value === 'test' || value === 'local') env = value;
	} else if (typeof __DEPLOY_ENV__ !== 'undefined') {
		const value = String(__DEPLOY_ENV__).trim();
		if (value === 'production' || value === 'test' || value === 'local') env = value;
	}
	return {
		service_name: SERVICE,
		deployment_environment: env
	};
}

/** Palabra de ruta o versión (`v1`). Un id no cabe en este patrón. */
function isFixedSegment(segment) {
	if (/^v\d+$/.test(segment)) return true;
	return /^[a-z]+(?:[-_][a-z]+)*$/.test(segment);
}

/**
 * Plantilla para `http_route`. Sin query y sin ids.
 * Si el path ya trae `{...}`, se respeta. Si hay un segmento opaco, la etiqueta
 * es el primer segmento fijo más `{id}` (`/units/abc/profile` → `/units/{id}`).
 * @param {string} path
 */
export function httpRouteTemplate(path) {
	try {
		const clean = String(path ?? '').split('?')[0];
		if (!clean) return 'unspecified';
		if (clean.includes('{')) return clean.startsWith('/') ? clean : `/${clean}`;
		const segments = clean.split('/').filter(Boolean);
		if (segments.length === 0) return '/';
		const opaque = segments.some((seg) => !isFixedSegment(seg));
		if (!opaque) return `/${segments.join('/')}`;
		const firstFixed = segments.find((seg) => isFixedSegment(seg));
		if (!firstFixed) return '/{id}';
		return `/${firstFixed}/{id}`;
	} catch {
		return 'unspecified';
	}
}

function labels(input = {}) {
	return {
		...resourceMetricAttrs(),
		http_route: String(input.route || 'unspecified'),
		http_method: String(input.method || 'GET').toUpperCase(),
		http_status_code: String(input.statusCode ?? 0)
	};
}

function durationHistogram(name) {
	return getMeter().createHistogram(name, {
		advice: { explicitBucketBoundaries: DURATION_BINS }
	});
}

/**
 * Histograma que consultan los dashboards: http_*_duration_milliseconds_{count,sum,bucket}.
 * @param {{ route?: string, method?: string, statusCode?: number, durationMs?: number }} input
 */
export function recordHttpServer(input = {}) {
	try {
		durationHistogram('http_server_duration_milliseconds').record(
			Number(input.durationMs) || 0,
			labels(input)
		);
	} catch {
		/* fail-open */
	}
}

/**
 * @param {{ route?: string, method?: string, statusCode?: number, durationMs?: number, targetService?: string }} input
 */
export function recordHttpClient(input = {}) {
	try {
		const attrs = {
			...labels(input),
			http_target_service: String(input.targetService || 'unspecified')
		};
		durationHistogram('http_client_duration_milliseconds').record(
			Number(input.durationMs) || 0,
			attrs
		);
		const code = Number(input.statusCode);
		if (!Number.isFinite(code) || code === 0 || code >= 400) {
			getMeter().createCounter('http_client_errors_total').add(1, attrs);
		}
	} catch {
		/* fail-open */
	}
}

/**
 * fetch nativo + métricas RED con los nombres que Grafana ya grafica.
 * @param {string} url
 * @param {RequestInit & { route?: string, targetService?: string }} [options]
 */
export async function instrumentedFetch(url, options = {}) {
	const { route, targetService, ...fetchOpts } = options;
	const start = Date.now();
	const method = String(fetchOpts.method || 'GET').toUpperCase();
	const httpRoute = route || scrubUrl(url) || 'unspecified';
	const target = targetService || 'unspecified';
	try {
		const response = await fetch(url, fetchOpts);
		recordHttpClient({
			route: httpRoute,
			method,
			statusCode: response.status,
			durationMs: Date.now() - start,
			targetService: target
		});
		return response;
	} catch (error) {
		recordHttpClient({
			route: httpRoute,
			method,
			statusCode: 0,
			durationMs: Date.now() - start,
			targetService: target
		});
		throw error;
	}
}
