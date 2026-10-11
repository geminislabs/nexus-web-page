import { describe, expect, it } from 'vitest';
import { apiOrigins, cspDirectives } from '../src/lib/security/csp.js';

const PROD = {
	VITE_ADMIN_API_URL: 'https://admin.geminislabs.com',
	VITE_COMM_API_URL: 'https://api.geminislabs.com',
	VITE_COMPANY_URL: 'https://geminislabs.com'
};

describe('apiOrigins', () => {
	it('deriva el WebSocket seguro de una API https', () => {
		expect(apiOrigins(PROD)).toEqual([
			'https://admin.geminislabs.com',
			'https://api.geminislabs.com',
			'wss://api.geminislabs.com'
		]);
	});

	it('en local conserva el puerto y usa ws:', () => {
		expect(apiOrigins({ VITE_COMM_API_URL: 'http://10.8.0.1:8000' })).toEqual([
			'http://10.8.0.1:8000',
			'ws://10.8.0.1:8000'
		]);
	});

	it('reduce las URLs con ruta a su origen y no repite', () => {
		expect(
			apiOrigins({
				VITE_API_BASE_URL: 'https://admin.geminislabs.com/api/v1',
				VITE_ADMIN_API_URL: 'https://admin.geminislabs.com/'
			})
		).toEqual(['https://admin.geminislabs.com']);
	});

	it('ignora lo que no es una URL http(s)', () => {
		expect(
			apiOrigins({
				VITE_API_BASE_URL: '',
				VITE_ADMIN_API_URL: 'admin',
				VITE_COMM_API_URL: 'ftp://x'
			})
		).toEqual([]);
	});
});

describe('cspDirectives', () => {
	const csp = cspDirectives(PROD);

	it('script-src no admite inline ni eval: el nonce lo pone SvelteKit', () => {
		expect(csp['script-src']).not.toContain('unsafe-inline');
		expect(csp['script-src']).not.toContain('unsafe-eval');
		expect(csp['script-src']).toContain('https://maps.googleapis.com');
	});

	it('connect-src no acepta esquemas comodín', () => {
		for (const scheme of ['http:', 'https:', 'ws:', 'wss:']) {
			expect(csp['connect-src']).not.toContain(scheme);
		}
		expect(csp['connect-src']).toEqual(
			expect.arrayContaining(['self', 'https://api.geminislabs.com', 'wss://api.geminislabs.com'])
		);
	});

	it('el sitio corporativo no entra: solo se navega a él, no se le llama', () => {
		expect(csp['connect-src'].join(' ')).not.toMatch(/\/\/(www\.)?geminislabs\.com/);
	});

	it('Google Fonts queda fuera', () => {
		const all = Object.values(csp).flat().join(' ');
		expect(all).not.toContain('fonts.googleapis.com');
		expect(csp['font-src']).toEqual(['self', 'data:']);
	});

	it('no se puede enmarcar ni cargar plugins', () => {
		expect(csp['frame-ancestors']).toEqual(['none']);
		expect(csp['object-src']).toEqual(['none']);
	});
});
