import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

/**
 * El refresh con la rotación de refresh tokens activa en Cognito.
 *
 * Cada refresh invalida el token que usó, así que dos refresh con el mismo token
 * ya no son inofensivos. Medido en producción el 09/10/2026: el temporizador y el
 * interceptor de 401 renovaban por separado —tres refresh en el mismo
 * milisegundo, uno limitado por Cognito— y una pestaña se quedó reintentando
 * cada minuto con un token que ya no servía.
 */

/** Un almacén de sesión en memoria que se comporta como `localStorage` compartido. */
function sesionFalsa({ expiraPronto = true } = {}) {
	const estado = { token: 'access-viejo', refresh: 'refresh-viejo', expiraPronto };
	const authToken = {
		getToken: () => estado.token,
		getRefreshToken: () => estado.refresh,
		isTokenExpiringSoon: () => estado.expiraPronto,
		setSession: vi.fn((s) => {
			if (s.access_token) estado.token = s.access_token;
			if (s.refresh_token) estado.refresh = s.refresh_token;
			estado.expiraPronto = false;
		}),
		clearToken: vi.fn(() => {
			estado.token = null;
			estado.refresh = null;
		})
	};
	const user = { subscribe: vi.fn(), logout: vi.fn() };
	return { estado, authToken, user };
}

function respuesta(cuerpo, status = 200) {
	return new Response(JSON.stringify(cuerpo), {
		status,
		headers: { 'content-type': 'application/json' }
	});
}

const SESION_NUEVA = {
	access_token: 'access-nuevo',
	refresh_token: 'refresh-nuevo',
	expires_in: 3600
};

/** @param {ReturnType<typeof vi.fn>} fetchMock */
function llamadasARefresh(fetchMock) {
	return fetchMock.mock.calls.filter(([url]) => String(url).endsWith('/auth/refresh'));
}

async function cargar(sesion) {
	vi.doMock('../src/lib/stores/auth.js', () => ({
		authToken: sesion.authToken,
		user: sesion.user
	}));
	vi.doMock('../src/lib/stores/organizationStore.js', () => ({
		activeOrganizationId: { get: () => null }
	}));
	const { apiService } = await import('../src/lib/services/api.js');
	return apiService;
}

describe('refresh con rotación', () => {
	beforeEach(() => {
		vi.stubGlobal('fetch', vi.fn());
		vi.resetModules();
	});

	afterEach(() => {
		vi.unstubAllGlobals();
		vi.useRealTimers();
	});

	it('el temporizador y el interceptor de 401 a la vez mandan un solo refresh', async () => {
		const fetchMock = /** @type {ReturnType<typeof vi.fn>} */ (globalThis.fetch);
		fetchMock.mockImplementation(async (url, init) => {
			if (String(url).endsWith('/auth/refresh')) return respuesta(SESION_NUEVA);
			return init.headers.Authorization === 'Bearer access-nuevo'
				? respuesta([{ id: '1' }])
				: respuesta({ detail: 'expired' }, 401);
		});
		const sesion = sesionFalsa();
		const api = await cargar(sesion);

		const [, unidades] = await Promise.all([api.refreshIfExpiringSoon(), api.getUnits()]);

		expect(unidades).toEqual([{ id: '1' }]);
		expect(llamadasARefresh(fetchMock)).toHaveLength(1);
	});

	it('no renueva si otra pestaña rotó el token mientras se esperaba el candado', async () => {
		const fetchMock = /** @type {ReturnType<typeof vi.fn>} */ (globalThis.fetch);
		const sesion = sesionFalsa();
		// La otra pestaña tiene el candado; al soltarlo ya dejó su sesión guardada.
		vi.stubGlobal('navigator', {
			locks: {
				request: async (_nombre, fn) => {
					sesion.estado.token = 'access-de-la-otra';
					sesion.estado.refresh = 'refresh-de-la-otra';
					sesion.estado.expiraPronto = false;
					return fn();
				}
			}
		});
		const api = await cargar(sesion);

		await api.refreshIfExpiringSoon();

		expect(llamadasARefresh(fetchMock)).toHaveLength(0);
		expect(sesion.user.logout).not.toHaveBeenCalled();
	});

	it('un 401 que llega cuando otra pestaña ya renovó reintenta sin renovar', async () => {
		const fetchMock = /** @type {ReturnType<typeof vi.fn>} */ (globalThis.fetch);
		const sesion = sesionFalsa({ expiraPronto: false });
		fetchMock
			.mockImplementationOnce(async () => {
				// Mientras la petición viaja, otra pestaña renueva.
				sesion.estado.token = 'access-de-la-otra';
				sesion.estado.refresh = 'refresh-de-la-otra';
				return respuesta({ detail: 'expired' }, 401);
			})
			.mockResolvedValueOnce(respuesta([{ id: '1' }]));
		const api = await cargar(sesion);

		const unidades = await api.getUnits();

		expect(unidades).toEqual([{ id: '1' }]);
		expect(llamadasARefresh(fetchMock)).toHaveLength(0);
		expect(fetchMock.mock.calls[1][1].headers.Authorization).toBe('Bearer access-de-la-otra');
	});

	it('un 401 del refresh proactivo cierra la sesión en vez de reintentar cada minuto', async () => {
		const fetchMock = /** @type {ReturnType<typeof vi.fn>} */ (globalThis.fetch);
		fetchMock.mockResolvedValue(respuesta({ detail: 'Refresh token inválido' }, 401));
		const sesion = sesionFalsa();
		const api = await cargar(sesion);

		await api.refreshIfExpiringSoon();

		expect(sesion.user.logout).toHaveBeenCalledOnce();
		expect(sesion.authToken.clearToken).toHaveBeenCalledOnce();
	});

	it('otro fallo del refresh proactivo espera antes de reintentar, y la espera crece', async () => {
		vi.useFakeTimers();
		const fetchMock = /** @type {ReturnType<typeof vi.fn>} */ (globalThis.fetch);
		fetchMock.mockResolvedValue(respuesta({ detail: 'Error al renovar el token' }, 500));
		const sesion = sesionFalsa();
		const api = await cargar(sesion);

		await api.refreshIfExpiringSoon();
		expect(llamadasARefresh(fetchMock)).toHaveLength(1);
		expect(sesion.user.logout).not.toHaveBeenCalled();

		// El temporizador vuelve al minuto: todavía no toca.
		vi.advanceTimersByTime(60 * 1000);
		await api.refreshIfExpiringSoon();
		expect(llamadasARefresh(fetchMock)).toHaveLength(1);

		// A los dos minutos sí; falla otra vez y la espera pasa a cuatro.
		vi.advanceTimersByTime(60 * 1000);
		await api.refreshIfExpiringSoon();
		expect(llamadasARefresh(fetchMock)).toHaveLength(2);

		vi.advanceTimersByTime(3 * 60 * 1000);
		await api.refreshIfExpiringSoon();
		expect(llamadasARefresh(fetchMock)).toHaveLength(2);

		vi.advanceTimersByTime(60 * 1000);
		await api.refreshIfExpiringSoon();
		expect(llamadasARefresh(fetchMock)).toHaveLength(3);
	});

	it('un 429 del refresh tras un 401 conserva la sesión y no reintenta en bucle', async () => {
		// Medido en producción el 14/10/2026: Cognito limitó una renovación y el
		// backend respondió 429 con `Retry-After`. El refresh token sigue valiendo;
		// cerrar la sesión ahí manda al login a alguien que no tenía por qué.
		const fetchMock = /** @type {ReturnType<typeof vi.fn>} */ (globalThis.fetch);
		fetchMock.mockImplementation(async (url) =>
			String(url).endsWith('/auth/refresh')
				? respuesta({ detail: 'Demasiadas renovaciones seguidas.' }, 429)
				: respuesta({ detail: 'expired' }, 401)
		);
		const sesion = sesionFalsa();
		const api = await cargar(sesion);

		await expect(api.getUnits()).rejects.toMatchObject({ status: 429 });

		expect(sesion.user.logout).not.toHaveBeenCalled();
		expect(sesion.authToken.clearToken).not.toHaveBeenCalled();
		expect(llamadasARefresh(fetchMock)).toHaveLength(1);
	});

	it('un fallo de red del refresh tras un 401 conserva la sesión', async () => {
		const fetchMock = /** @type {ReturnType<typeof vi.fn>} */ (globalThis.fetch);
		fetchMock.mockImplementation(async (url) => {
			if (String(url).endsWith('/auth/refresh')) throw new TypeError('Failed to fetch');
			return respuesta({ detail: 'expired' }, 401);
		});
		const sesion = sesionFalsa();
		const api = await cargar(sesion);

		await expect(api.getUnits()).rejects.toThrow();

		expect(sesion.user.logout).not.toHaveBeenCalled();
		expect(sesion.authToken.clearToken).not.toHaveBeenCalled();
	});

	it('un 401 del refresh tras un 401 sí cierra la sesión', async () => {
		const fetchMock = /** @type {ReturnType<typeof vi.fn>} */ (globalThis.fetch);
		fetchMock.mockImplementation(async (url) =>
			String(url).endsWith('/auth/refresh')
				? respuesta({ detail: 'Refresh token inválido' }, 401)
				: respuesta({ detail: 'expired' }, 401)
		);
		const sesion = sesionFalsa();
		const api = await cargar(sesion);

		await expect(api.getUnits()).rejects.toMatchObject({ status: 401 });

		expect(sesion.user.logout).toHaveBeenCalledOnce();
		expect(sesion.authToken.clearToken).toHaveBeenCalledOnce();
	});

	it('un refresh que funciona guarda el token rotado', async () => {
		const fetchMock = /** @type {ReturnType<typeof vi.fn>} */ (globalThis.fetch);
		fetchMock.mockResolvedValue(respuesta(SESION_NUEVA));
		const sesion = sesionFalsa();
		const api = await cargar(sesion);

		await api.refreshIfExpiringSoon();

		expect(sesion.estado.refresh).toBe('refresh-nuevo');
		const [, init] = llamadasARefresh(fetchMock)[0];
		expect(JSON.parse(init.body)).toEqual({ refresh_token: 'refresh-viejo' });
		expect(init.headers.Authorization).toBe('Bearer access-viejo');
	});
});
