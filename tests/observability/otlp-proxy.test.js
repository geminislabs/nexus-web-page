import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import {
	POST,
	_excedeLaTasa as excedeLaTasa,
	_origenAjeno as origenAjeno,
	_reiniciarContadorParaTests as reiniciarContadorParaTests
} from '../../src/routes/internal/otlp/[...path]/+server.js';

/**
 * Petición de servidor, no de navegador.
 *
 * No se usa `new Request(...)` a propósito: el entorno de pruebas es happy-dom,
 * que aplica la lista de cabeceras prohibidas del browser y **borra en silencio
 * `host`, `origin` y `content-length`** — justo las tres que comprueba esta
 * ruta. Una prueba escrita con `Request` pasaría en verde sin ejercitar nada.
 * En el servidor, que es donde corre este código, esas cabeceras sí llegan.
 *
 * @param {string} path
 * @param {{ body?: string, headers?: Record<string,string>, cliente?: string }} [opts]
 */
function peticion(path, opts = {}) {
	const cabeceras = new Map(
		Object.entries({
			'content-type': 'application/json',
			host: 'sitio.test',
			...(opts.headers ?? {})
		}).map(([clave, valor]) => [clave.toLowerCase(), String(valor)])
	);
	const cuerpo = opts.body ?? '{}';

	return {
		params: { path },
		request: {
			headers: { get: (nombre) => cabeceras.get(String(nombre).toLowerCase()) ?? null },
			arrayBuffer: async () => new TextEncoder().encode(cuerpo).buffer
		},
		getClientAddress: () => opts.cliente ?? '10.0.0.1'
	};
}

describe('OTLP same-origin proxy', () => {
	beforeEach(() => {
		reiniciarContadorParaTests();
		vi.stubEnv('OTLP_ENDPOINT', 'http://collector.test:4318');
	});

	afterEach(() => {
		vi.unstubAllGlobals();
		vi.unstubAllEnvs();
		vi.restoreAllMocks();
	});

	it('reenvía al collector configurado', async () => {
		const fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 200 });
		vi.stubGlobal('fetch', fetchMock);

		const response = await POST(peticion('v1/metrics', { body: '{"resourceMetrics":[]}' }));

		expect(response.status).toBe(204);
		expect(fetchMock).toHaveBeenCalledWith(
			'http://collector.test:4318/v1/metrics',
			expect.objectContaining({ method: 'POST' })
		);
	});

	it('ruta no permitida responde 404 y no llama al collector', async () => {
		const fetchMock = vi.fn();
		vi.stubGlobal('fetch', fetchMock);

		const response = await POST(peticion('v1/hack'));

		expect(response.status).toBe(404);
		expect(fetchMock).not.toHaveBeenCalled();
	});

	it('si el collector falla, igual 204 (fail-open)', async () => {
		vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Failed to fetch')));

		const response = await POST(peticion('v1/logs'));

		expect(response.status).toBe(204);
	});

	// --- Corte 2: la ruta es pública, así que esto es lo que la protege ---

	it('rechaza un origen ajeno aunque el resto esté bien', async () => {
		const fetchMock = vi.fn();
		vi.stubGlobal('fetch', fetchMock);

		const response = await POST(
			peticion('v1/traces', { headers: { origin: 'https://otro-sitio.test' } })
		);

		expect(response.status).toBe(403);
		expect(fetchMock).not.toHaveBeenCalled();
	});

	it('acepta el origen propio', async () => {
		const fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 200 });
		vi.stubGlobal('fetch', fetchMock);

		const response = await POST(
			peticion('v1/traces', { headers: { origin: 'http://sitio.test' } })
		);

		expect(response.status).toBe(204);
		expect(fetchMock).toHaveBeenCalled();
	});

	it('rechaza por `content-length` sin llegar a leer el cuerpo', async () => {
		const fetchMock = vi.fn();
		vi.stubGlobal('fetch', fetchMock);

		const response = await POST(
			peticion('v1/logs', { headers: { 'content-length': String(2 * 1024 * 1024) } })
		);

		expect(response.status).toBe(413);
		expect(fetchMock).not.toHaveBeenCalled();
	});

	it('rechaza por tamaño real aunque la cabecera mienta', async () => {
		const fetchMock = vi.fn();
		vi.stubGlobal('fetch', fetchMock);

		const response = await POST(peticion('v1/logs', { body: 'x'.repeat(600 * 1024) }));

		expect(response.status).toBe(413);
		expect(fetchMock).not.toHaveBeenCalled();
	});

	it('corta por tasa al cliente que insiste', async () => {
		const fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 200 });
		vi.stubGlobal('fetch', fetchMock);

		let ultima;
		for (let i = 0; i < 245; i += 1) {
			ultima = await POST(peticion('v1/metrics', { cliente: '10.0.0.9' }));
		}

		expect(ultima.status).toBe(429);
	});

	it('el límite es por cliente, no global', () => {
		const ahora = Date.now();
		for (let i = 0; i < 241; i += 1) excedeLaTasa('10.0.0.1', ahora);

		expect(excedeLaTasa('10.0.0.1', ahora)).toBe(true);
		expect(excedeLaTasa('10.0.0.2', ahora)).toBe(false);
	});

	it('la ventana se reabre pasado el minuto', () => {
		const ahora = Date.now();
		for (let i = 0; i < 250; i += 1) excedeLaTasa('10.0.0.3', ahora);

		expect(excedeLaTasa('10.0.0.3', ahora)).toBe(true);
		expect(excedeLaTasa('10.0.0.3', ahora + 61_000)).toBe(false);
	});

	it('sin `Origin` no se rechaza: hay clientes que no lo mandan', () => {
		expect(origenAjeno(peticion('v1/logs').request)).toBe(false);
	});

	it('con `Origin` ilegible se rechaza', () => {
		expect(origenAjeno(peticion('v1/logs', { headers: { origin: 'no-es-una-url' } }).request)).toBe(
			true
		);
	});

	it('detrás de un proxy manda `x-forwarded-host`', () => {
		const detrasDelProxy = peticion('v1/logs', {
			headers: { origin: 'https://geminislabs.com', 'x-forwarded-host': 'geminislabs.com' }
		}).request;

		expect(origenAjeno(detrasDelProxy)).toBe(false);
	});

	it('sin collector configurado no se inventa el de desarrollo', async () => {
		vi.stubEnv('OTLP_ENDPOINT', '');
		const fetchMock = vi.fn();
		vi.stubGlobal('fetch', fetchMock);

		const response = await POST(peticion('v1/traces'));

		expect(response.status).toBe(204);
		expect(fetchMock).not.toHaveBeenCalled();
	});
});
