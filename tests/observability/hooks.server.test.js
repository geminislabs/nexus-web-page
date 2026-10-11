import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { metrics } from '@opentelemetry/api';

vi.hoisted(() => {
	process.env.OTLP_ENDPOINT = '';
});

import { handle, handleError } from '../../src/hooks.server.js';

/**
 * @param {{
 *   routeId?: string | null,
 *   pathname?: string,
 *   search?: string,
 *   method?: string,
 *   headers?: Record<string, string>
 * }} [opts]
 */
function makeEvent(opts = {}) {
	const pathname = opts.pathname ?? '/health';
	const search = opts.search ?? '';
	return {
		route: { id: opts.routeId === undefined ? '/health' : opts.routeId },
		url: new URL(`https://app.local${pathname}${search}`),
		request: {
			method: opts.method ?? 'GET',
			headers: new Headers(opts.headers ?? {})
		}
	};
}

describe('hooks.server handle', () => {
	/** @type {ReturnType<typeof vi.fn>} */
	let record;

	beforeEach(() => {
		record = vi.fn();
		vi.spyOn(metrics, 'getMeter').mockReturnValue({
			createHistogram: () => ({ record }),
			createCounter: () => ({ add: vi.fn() })
		});
	});

	afterEach(() => {
		vi.restoreAllMocks();
	});

	it('resolve corre para requests normales y registra http_server_duration', async () => {
		const response = await handle({
			event: makeEvent(),
			resolve: async () => ({ status: 200, body: 'ok' })
		});
		expect(response).toEqual({ status: 200, body: 'ok' });
		expect(record).toHaveBeenCalledWith(
			expect.any(Number),
			expect.objectContaining({
				http_route: '/health',
				http_method: 'GET',
				http_status_code: '200'
			})
		);
	});

	it('route es event.route.id, no la URL ni el query', async () => {
		await handle({
			event: makeEvent({
				routeId: '/api/v1/auth/login',
				pathname: '/api/v1/auth/login',
				search: '?token=SECRET'
			}),
			resolve: async () => ({ status: 200 })
		});
		expect(record.mock.calls[0][1].http_route).toBe('/api/v1/auth/login');
		expect(JSON.stringify(record.mock.calls)).not.toContain('SECRET');
	});

	it('status 500 se registra cuando resolve throw', async () => {
		await expect(
			handle({
				event: makeEvent(),
				resolve: async () => {
					throw new Error('boom');
				}
			})
		).rejects.toThrow('boom');
		expect(record).toHaveBeenCalledWith(
			expect.any(Number),
			expect.objectContaining({ http_status_code: '500' })
		);
	});

	it('/internal/otlp no registra http_server_duration', async () => {
		await handle({
			event: makeEvent({
				routeId: '/internal/otlp/[...path]',
				pathname: '/internal/otlp/v1/metrics'
			}),
			resolve: async () => ({ status: 204 })
		});
		expect(record).not.toHaveBeenCalled();
	});

	it('error en resolve hace re-throw (no swallowear)', async () => {
		const err = new Error('resolve failed');
		await expect(
			handle({
				event: makeEvent(),
				resolve: async () => {
					throw err;
				}
			})
		).rejects.toBe(err);
	});

	it('/internal/otlp se resuelve sin throw', async () => {
		const response = await handle({
			event: makeEvent({
				routeId: '/internal/otlp/[...path]',
				pathname: '/internal/otlp/v1/metrics'
			}),
			resolve: async () => ({ status: 204 })
		});
		expect(response).toEqual({ status: 204 });
	});

	it('handleError reporta y no throw', () => {
		expect(() => handleError({ error: new TypeError('boom'), message: 'boom' })).not.toThrow();
		const result = handleError({ error: new Error('x'), message: 'x' });
		expect(result).toEqual({ message: 'x' });
	});

	it('conserva las cabeceras de seguridad y el route id de /share/[token]', async () => {
		const response = await handle({
			event: makeEvent({
				routeId: '/share/[token]',
				pathname: '/share/SECRETTOKEN'
			}),
			resolve: async () => new Response('ok', { status: 200 })
		});
		expect(response.headers.get('X-Content-Type-Options')).toBe('nosniff');
		expect(response.headers.get('X-Frame-Options')).toBe('DENY');
		expect(response.headers.get('Content-Security-Policy-Report-Only')).toContain(
			"default-src 'self'"
		);
		expect(response.headers.get('Referrer-Policy')).toBe('no-referrer');
		expect(record).toHaveBeenCalledWith(
			expect.any(Number),
			expect.objectContaining({ http_route: '/share/[token]' })
		);
		expect(JSON.stringify(record.mock.calls)).not.toContain('SECRETTOKEN');
	});
});
