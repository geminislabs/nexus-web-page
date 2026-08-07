import { describe, it, expect, vi, beforeEach } from 'vitest';

describe('legal constants', () => {
	beforeEach(() => {
		vi.resetModules();
		vi.unstubAllEnvs();
	});

	it('usa VITE_COMPANY_URL como base de los cuatro documentos', async () => {
		vi.stubEnv('VITE_COMPANY_URL', 'https://geminis.dev/');
		const { getLegalLinks, getCompanyBaseUrl } = await import('../src/lib/constants/legal.js');
		expect(getCompanyBaseUrl()).toBe('https://geminis.dev');
		expect(getLegalLinks().map((l) => l.href)).toEqual([
			'https://geminis.dev/legal/privacidad',
			'https://geminis.dev/legal/terminos',
			'https://geminis.dev/legal/aviso-legal',
			'https://geminis.dev/legal/cookies'
		]);
	});

	it('hace fallback a geminislabs.com si no hay VITE_COMPANY_URL', async () => {
		vi.stubEnv('VITE_COMPANY_URL', '');
		const { getCompanyBaseUrl, getLegalLinks } = await import('../src/lib/constants/legal.js');
		expect(getCompanyBaseUrl()).toBe('https://www.geminislabs.com');
		expect(getLegalLinks()).toHaveLength(4);
		expect(
			getLegalLinks().every((l) => l.href.startsWith('https://www.geminislabs.com/legal/'))
		).toBe(true);
	});

	it('expone ids y etiquetas estables', async () => {
		vi.stubEnv('VITE_COMPANY_URL', 'https://example.com');
		const { getLegalLinks } = await import('../src/lib/constants/legal.js');
		expect(getLegalLinks().map((l) => l.id)).toEqual([
			'privacidad',
			'terminos',
			'aviso-legal',
			'cookies'
		]);
		expect(getLegalLinks().map((l) => l.label)).toEqual([
			'Privacidad',
			'Términos',
			'Aviso legal',
			'Cookies'
		]);
	});
});
