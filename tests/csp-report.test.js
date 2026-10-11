import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
	POST,
	_origenBloqueado,
	_paginaSinToken,
	_reiniciarParaTests
} from '../src/routes/internal/csp-report/+server.js';

/** @param {unknown} body @param {Record<string, string>} [headers] */
function reporte(body, headers = {}) {
	const text = typeof body === 'string' ? body : JSON.stringify(body);
	return {
		request: new Request('http://localhost/internal/csp-report', {
			method: 'POST',
			headers: { 'content-type': 'application/csp-report', ...headers },
			body: text
		})
	};
}

const violacion = {
	'csp-report': {
		'document-uri': 'https://nexus.geminislabs.com/share/v4.public.SECRETO?x=1',
		'effective-directive': 'connect-src',
		'blocked-uri': 'https://evil.example/ruta/con/token?k=SECRETO',
		'source-file': 'https://nexus.geminislabs.com/_app/immutable/chunk.js',
		disposition: 'report'
	}
};

describe('/internal/csp-report', () => {
	/** @type {import('vitest').MockInstance} */
	let warn;

	beforeEach(() => {
		_reiniciarParaTests();
		warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
	});

	afterEach(() => warn.mockRestore());

	it('registra la violación en una línea JSON sin tokens ni rutas', async () => {
		const response = await POST(reporte(violacion));

		expect(response.status).toBe(204);
		expect(warn).toHaveBeenCalledTimes(1);
		const linea = warn.mock.calls[0][0];
		expect(JSON.parse(linea)).toEqual({
			event: 'csp_violation',
			directive: 'connect-src',
			blocked: 'https://evil.example',
			page: '/share/[token]',
			source: 'https://nexus.geminislabs.com',
			disposition: 'report'
		});
		expect(linea).not.toContain('SECRETO');
	});

	it('la misma violación repetida se registra una sola vez', async () => {
		await POST(reporte(violacion));
		await POST(reporte(violacion));
		await POST(reporte(violacion));

		expect(warn).toHaveBeenCalledTimes(1);
	});

	it('rechaza cuerpos grandes', async () => {
		const response = await POST(reporte('x'.repeat(64 * 1024)));

		expect(response.status).toBe(413);
		expect(warn).not.toHaveBeenCalled();
	});

	it('un cuerpo malformado responde 204 y no registra nada', async () => {
		expect((await POST(reporte('no es json'))).status).toBe(204);
		expect((await POST(reporte({ otra: 'cosa' }))).status).toBe(204);
		expect(warn).not.toHaveBeenCalled();
	});

	it('conserva las fuentes que no son URL', () => {
		expect(_origenBloqueado('inline')).toBe('inline');
		expect(_origenBloqueado('eval')).toBe('eval');
		expect(_origenBloqueado('data:image/png;base64,AAAA')).toBe('data');
		expect(_origenBloqueado('wss://api.geminislabs.com/ws?token=x')).toBe(
			'wss://api.geminislabs.com'
		);
	});

	it('la página va sin query', () => {
		expect(_paginaSinToken('https://nexus.geminislabs.com/dashboard?unit=1')).toBe('/dashboard');
	});
});
