import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { metrics } from '@opentelemetry/api';
import {
	httpRouteTemplate,
	instrumentedFetch,
	recordHttpClient,
	recordHttpServer
} from '../../src/lib/observability/http.js';

describe('http metrics', () => {
	/** @type {ReturnType<typeof vi.fn>} */
	let record;
	/** @type {ReturnType<typeof vi.fn>} */
	let add;

	beforeEach(() => {
		record = vi.fn();
		add = vi.fn();
		vi.spyOn(metrics, 'getMeter').mockReturnValue({
			createHistogram: () => ({ record }),
			createCounter: () => ({ add })
		});
	});

	afterEach(() => {
		vi.restoreAllMocks();
		vi.unstubAllGlobals();
	});

	it('recordHttpServer usa http_route, http_method, http_status_code', () => {
		recordHttpServer({
			route: '/health',
			method: 'get',
			statusCode: 200,
			durationMs: 12
		});
		expect(record).toHaveBeenCalledWith(
			12,
			expect.objectContaining({
				http_route: '/health',
				http_method: 'GET',
				http_status_code: '200',
				service_name: 'nexus-web-page',
				deployment_environment: 'local'
			})
		);
	});

	it('recordHttpClient incrementa errors en 5xx', () => {
		recordHttpClient({
			route: '/api/v1/plans',
			method: 'GET',
			statusCode: 500,
			durationMs: 8,
			targetService: 'siscom-admin-api'
		});
		expect(record).toHaveBeenCalledWith(
			8,
			expect.objectContaining({
				http_route: '/api/v1/plans',
				http_target_service: 'siscom-admin-api',
				http_status_code: '500'
			})
		);
		expect(add).toHaveBeenCalledWith(1, expect.objectContaining({ http_status_code: '500' }));
	});

	it('instrumentedFetch registra duration y no pasa route al fetch nativo', async () => {
		const fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 200 });
		vi.stubGlobal('fetch', fetchMock);
		await instrumentedFetch('/api/v1/auth/login?token=SECRET', {
			method: 'POST',
			route: '/api/v1/auth/login',
			targetService: 'siscom-admin-api'
		});
		expect(fetchMock.mock.calls[0][1]).not.toHaveProperty('route');
		expect(fetchMock.mock.calls[0][1]).not.toHaveProperty('targetService');
		expect(record).toHaveBeenCalledWith(
			expect.any(Number),
			expect.objectContaining({
				http_route: '/api/v1/auth/login',
				http_target_service: 'siscom-admin-api',
				http_status_code: '200'
			})
		);
		expect(JSON.stringify(record.mock.calls)).not.toContain('SECRET');
	});

	it('instrumentedFetch re-throw y registra status 0', async () => {
		const err = new Error('offline');
		vi.stubGlobal('fetch', vi.fn().mockRejectedValue(err));
		await expect(instrumentedFetch('/x', { route: '/x', targetService: 'self' })).rejects.toBe(err);
		expect(record).toHaveBeenCalledWith(
			expect.any(Number),
			expect.objectContaining({ http_status_code: '0' })
		);
		expect(add).toHaveBeenCalled();
	});

	it('resourceMetricAttrs incluye service_name y entorno', async () => {
		const { resourceMetricAttrs } = await import('../../src/lib/observability/http.js');
		expect(resourceMetricAttrs()).toEqual({
			service_name: 'nexus-web-page',
			deployment_environment: 'local'
		});
		vi.stubEnv('DEPLOY_ENV', 'production');
		expect(resourceMetricAttrs().deployment_environment).toBe('production');
		vi.stubEnv('DEPLOY_ENV', 'test');
		expect(resourceMetricAttrs().deployment_environment).toBe('test');
		vi.unstubAllEnvs();
	});

	it('httpRouteTemplate quita query e ids y conserva el primer segmento fijo', () => {
		expect(httpRouteTemplate('/auth/login')).toBe('/auth/login');
		expect(httpRouteTemplate('/units/{id}/profile')).toBe('/units/{id}/profile');
		expect(httpRouteTemplate('/units/abc-123/profile?token=SECRET')).toBe('/units/{id}');
		expect(httpRouteTemplate('/api/v1/communications/latest?device_ids=867564050638581')).toBe(
			'/api/v1/communications/latest'
		);
		expect(httpRouteTemplate('/api/v1/events?unit_id=u1')).toBe('/api/v1/events');
		expect(JSON.stringify(httpRouteTemplate('/units/abc?device_ids=1&lat=19'))).not.toContain(
			'device_ids'
		);
	});

	it('fail-open si el meter throw', () => {
		vi.spyOn(metrics, 'getMeter').mockImplementation(() => {
			throw new Error('down');
		});
		expect(() => recordHttpServer({ route: '/x', statusCode: 200, durationMs: 1 })).not.toThrow();
	});
});
