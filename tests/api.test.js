import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { buildQueryString, withQuery } from '../src/lib/services/apiQuery.js';
import { ApiError, apiErrorFromResponse } from '../src/lib/services/apiErrors.js';

describe('apiQuery', () => {
	it('buildQueryString omite valores vacíos', () => {
		expect(buildQueryString({ a: 1, b: '', c: null, d: undefined })).toBe('a=1');
	});

	it('buildQueryString repite claves para arrays', () => {
		expect(buildQueryString({ unit_id: ['u1', 'u2'] })).toBe('unit_id=u1&unit_id=u2');
	});

	it('withQuery concatena path y query', () => {
		expect(withQuery('/trips', { unit_id: 'abc', day: '2025-01-01' })).toBe(
			'/trips?unit_id=abc&day=2025-01-01'
		);
	});
});

describe('apiErrors', () => {
	it('ApiError expone detail del backend y anidado', () => {
		const err = new ApiError('HTTP error', { status: 400, detail: 'Invitación pendiente' });
		expect(err.displayMessage).toBe('Invitación pendiente');
		expect(err.status).toBe(400);
		const nested = new ApiError('err', { detail: { detail: 'nested' } });
		expect(nested.displayMessage).toBe('nested');
	});

	it('parseErrorBody lee JSON y texto plano', async () => {
		const { parseErrorBody } = await import('../src/lib/services/apiErrors.js');
		const jsonRes = new Response(JSON.stringify({ errors: ['a'] }), {
			status: 422,
			headers: { 'content-type': 'application/json' }
		});
		const parsed = await parseErrorBody(jsonRes);
		expect(parsed.detail).toEqual(['a']);

		const textRes = new Response('plain error', { status: 500 });
		const textParsed = await parseErrorBody(textRes);
		expect(textParsed.detail).toBe('plain error');
	});

	it('apiErrorFromResponse parsea JSON con detail', async () => {
		const response = new Response(JSON.stringify({ detail: 'Credenciales inválidas' }), {
			status: 401,
			headers: { 'content-type': 'application/json' }
		});
		const err = await apiErrorFromResponse(response);
		expect(err).toBeInstanceOf(ApiError);
		expect(err.status).toBe(401);
		expect(err.displayMessage).toBe('Credenciales inválidas');

		const fallback = await apiErrorFromResponse(new Response('', { status: 503 }), 'fallback');
		expect(fallback.displayMessage).toBe('fallback');
	});
});

describe('apiService', () => {
	beforeEach(() => {
		vi.stubGlobal('fetch', vi.fn());
		vi.resetModules();
	});

	afterEach(() => {
		vi.unstubAllGlobals();
	});

	it('getUnits llama GET /units con Authorization', async () => {
		const fetchMock = /** @type {ReturnType<typeof vi.fn>} */ (globalThis.fetch);
		fetchMock.mockResolvedValue(
			new Response(JSON.stringify([{ id: '1', name: 'U1' }]), {
				status: 200,
				headers: { 'content-type': 'application/json' }
			})
		);

		vi.doMock('../src/lib/stores/auth.js', () => ({
			authToken: {
				getToken: () => 'test-access-token',
				getRefreshToken: () => null,
				setSession: vi.fn()
			},
			user: { subscribe: vi.fn() }
		}));

		const { apiService } = await import('../src/lib/services/api.js');
		const units = await apiService.getUnits();

		expect(units).toEqual([{ id: '1', name: 'U1' }]);
		expect(fetchMock).toHaveBeenCalledOnce();
		const [url, init] = fetchMock.mock.calls[0];
		expect(url).toMatch(/\/api\/v1\/units$/);
		expect(init.headers.Authorization).toBe('Bearer test-access-token');
	});

	it('assignDeviceToUnit envía POST /unit-devices', async () => {
		const fetchMock = /** @type {ReturnType<typeof vi.fn>} */ (globalThis.fetch);
		fetchMock.mockResolvedValue(
			new Response(JSON.stringify({ id: 'asg-1' }), {
				status: 201,
				headers: { 'content-type': 'application/json' }
			})
		);

		vi.doMock('../src/lib/stores/auth.js', () => ({
			authToken: { getToken: () => 'tok' },
			user: { subscribe: vi.fn() }
		}));

		const { apiService } = await import('../src/lib/services/api.js');
		await apiService.assignDeviceToUnit('unit-1', '864537040123456');

		const [, init] = fetchMock.mock.calls[0];
		expect(init.method).toBe('POST');
		expect(JSON.parse(init.body)).toEqual({
			unit_id: 'unit-1',
			device_id: '864537040123456'
		});
	});

	it('reintenta tras refresh en 401', async () => {
		const fetchMock = /** @type {ReturnType<typeof vi.fn>} */ (globalThis.fetch);
		fetchMock
			.mockResolvedValueOnce(new Response(JSON.stringify({ detail: 'expired' }), { status: 401 }))
			.mockResolvedValueOnce(
				new Response(
					JSON.stringify({
						access_token: 'new-tok',
						refresh_token: 'new-refresh',
						expires_in: 3600
					}),
					{ status: 200, headers: { 'content-type': 'application/json' } }
				)
			)
			.mockResolvedValueOnce(
				new Response(JSON.stringify([{ id: '1' }]), {
					status: 200,
					headers: { 'content-type': 'application/json' }
				})
			);

		vi.doMock('svelte/store', async (importOriginal) => {
			const actual = await importOriginal();
			return { ...actual, get: () => ({ email: 'user@test.com' }) };
		});

		vi.doMock('../src/lib/stores/auth.js', () => ({
			authToken: {
				getToken: () => 'old-tok',
				getRefreshToken: () => 'refresh-tok',
				setSession: vi.fn()
			},
			user: { subscribe: vi.fn() }
		}));

		const { apiService } = await import('../src/lib/services/api.js');
		const units = await apiService.getUnits();

		expect(units).toEqual([{ id: '1' }]);
		expect(fetchMock).toHaveBeenCalledTimes(3);
	});

	it('normaliza rutas legacy con /api/v1 duplicado', async () => {
		const fetchMock = /** @type {ReturnType<typeof vi.fn>} */ (globalThis.fetch);
		fetchMock.mockResolvedValue(
			new Response(JSON.stringify([]), {
				status: 200,
				headers: { 'content-type': 'application/json' }
			})
		);

		vi.doMock('../src/lib/stores/auth.js', () => ({
			authToken: { getToken: () => 'tok' },
			user: { subscribe: vi.fn() }
		}));

		const { apiService } = await import('../src/lib/services/api.js');
		await apiService.request('/api/v1/user-units?user_id=u1', { method: 'GET' });

		const [url] = fetchMock.mock.calls[0];
		expect(url).toMatch(/\/api\/v1\/user-units\?user_id=u1$/);
		expect(url).not.toMatch(/\/api\/v1\/api\/v1/);
	});
});
