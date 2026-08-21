import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('$app/environment', () => ({ browser: true }));

const requestMock = vi.fn();
vi.mock('../src/lib/services/api.js', () => ({
	apiService: { request: (/** @type {any} */ ...args) => requestMock(...args) }
}));

/** @param {number} [expiresIn] */
function issued(expiresIn = 600) {
	let n = 0;
	return () =>
		Promise.resolve({ token: `token-${++n}`, expires_in: expiresIn, token_type: 'Bearer' });
}

async function load() {
	vi.resetModules();
	return import('../src/lib/services/dataToken.js');
}

describe('dataToken', () => {
	beforeEach(() => {
		requestMock.mockReset();
		vi.useRealTimers();
	});

	it('pide el token al emisor y lo reutiliza mientras esté fresco', async () => {
		requestMock.mockImplementation(issued());
		const { getDataToken } = await load();

		expect(await getDataToken()).toBe('token-1');
		expect(await getDataToken()).toBe('token-1');
		expect(requestMock).toHaveBeenCalledTimes(1);
		expect(requestMock).toHaveBeenCalledWith('/auth/data-token', { method: 'POST' });
	});

	// Emitir revoca los tokens anteriores del mismo sujeto: dos emisiones
	// concurrentes se revocarían entre sí y dejarían al usuario sin credencial.
	it('comparte una sola emisión entre llamadas concurrentes', async () => {
		/** @type {(value: any) => void} */
		let release = () => {};
		requestMock.mockImplementation(
			() =>
				new Promise((resolve) => {
					release = resolve;
				})
		);
		const { getDataToken } = await load();

		const all = Promise.all([getDataToken(), getDataToken(), getDataToken()]);
		release({ token: 'token-1', expires_in: 600 });

		expect(await all).toEqual(['token-1', 'token-1', 'token-1']);
		expect(requestMock).toHaveBeenCalledTimes(1);
	});

	it('reemite cuando el token entra en su último 20% de vida', async () => {
		requestMock.mockImplementation(issued(100));
		const { getDataToken } = await load();

		expect(await getDataToken()).toBe('token-1');

		// 85 s de una vida de 100 s: pasado el umbral de refresco (80%).
		vi.spyOn(Date, 'now').mockReturnValue(Date.now() + 85_000);
		expect(await getDataToken()).toBe('token-2');
		expect(requestMock).toHaveBeenCalledTimes(2);
	});

	it('reintenta UNA sola vez ante un 403 y propaga si vuelve a fallar', async () => {
		requestMock.mockImplementation(issued());
		const { withDataToken, DataPlaneForbiddenError } = await load();

		const run = vi.fn(async () => new Response('nope', { status: 403 }));

		await expect(withDataToken(run, async (r) => r.text())).rejects.toBeInstanceOf(
			DataPlaneForbiddenError
		);

		// Un bucle de reintentos sería un bucle de revocaciones.
		expect(run).toHaveBeenCalledTimes(2);
		expect(run.mock.calls[0][0]).toBe('token-1');
		expect(run.mock.calls[1][0]).toBe('token-2');
	});

	it('el reintento con token fresco resuelve el caso de alcance obsoleto', async () => {
		requestMock.mockImplementation(issued());
		const { withDataToken } = await load();

		const run = vi
			.fn()
			.mockResolvedValueOnce(new Response('nope', { status: 403 }))
			.mockResolvedValueOnce(new Response('{"ok":true}', { status: 200 }));

		const parsed = await withDataToken(run, async (r) => r.json());

		expect(parsed).toEqual({ ok: true });
		expect(run).toHaveBeenCalledTimes(2);
	});

	it('siembra la credencial que adjunta el login y evita el round trip', async () => {
		requestMock.mockImplementation(issued());
		const { primeDataToken, getDataToken } = await load();

		primeDataToken({
			expires_in: 3600,
			data_token: { token: 'del-login', expires_in: 600, token_type: 'Bearer' }
		});

		expect(await getDataToken()).toBe('del-login');
		expect(requestMock).not.toHaveBeenCalled();
	});

	// El plano de datos no puede impedir iniciar sesión: sin Valkey se entra y se
	// ve la aplicación sin mapa. `data_token: null` es normal, no un error.
	it('ignora un login sin data_token y pide el token al endpoint dedicado', async () => {
		requestMock.mockImplementation(issued());
		const { primeDataToken, getDataToken } = await load();

		primeDataToken({ data_token: null });

		expect(await getDataToken()).toBe('token-1');
		expect(requestMock).toHaveBeenCalledTimes(1);
	});

	// Hay dos expires_in en la respuesta de login: el de fuera es el de la
	// sesión (una hora) y el de dentro el del data token (minutos). Tomar el de
	// fuera daría por fresca una credencial caducada hace rato.
	it('usa la vida del data token, no la de la sesión que lo envuelve', async () => {
		requestMock.mockImplementation(issued());
		const { primeDataToken, getDataToken } = await load();

		primeDataToken({
			expires_in: 3600,
			data_token: { token: 'del-login', expires_in: 600 }
		});

		// A los 9 minutos, la credencial sembrada ya entró en su último 20%.
		vi.spyOn(Date, 'now').mockReturnValue(Date.now() + 9 * 60_000);
		expect(await getDataToken()).toBe('token-1');
	});

	// 404 no se reintenta: reemitir daría la misma respuesta. Y no puede
	// colapsarse con la serie vacía, que afirmaría que no hubo telemetría.
	it('no reintenta ante un 404 y lo distingue del rechazo de alcance', async () => {
		requestMock.mockImplementation(issued());
		const { withDataToken, DataPlaneOutOfWindowError } = await load();

		const run = vi.fn(async () => new Response('', { status: 404 }));

		await expect(withDataToken(run, async (r) => r.text())).rejects.toBeInstanceOf(
			DataPlaneOutOfWindowError
		);
		expect(run).toHaveBeenCalledTimes(1);
	});

	it('clearDataToken obliga a volver a emitir', async () => {
		requestMock.mockImplementation(issued());
		const { getDataToken, clearDataToken } = await load();

		expect(await getDataToken()).toBe('token-1');
		clearDataToken();
		expect(await getDataToken()).toBe('token-2');
	});

	it('conserva el token vigente si falla un refresco preventivo', async () => {
		requestMock.mockImplementationOnce(issued(100)).mockRejectedValue(new Error('sin red'));
		const { getDataToken } = await load();

		expect(await getDataToken()).toBe('token-1');

		vi.spyOn(Date, 'now').mockReturnValue(Date.now() + 85_000);
		expect(await getDataToken()).toBe('token-1');
	});
});
