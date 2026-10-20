import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
	MARCA_POR_DEFECTO,
	_vaciarCache,
	hostDeLaPeticion,
	marcaDesdeConfig,
	resolverMarca
} from '../src/lib/server/brand.js';
import { descripcionDe, logoDe, tituloDe } from '../src/lib/brand.js';

/**
 * La marca por Host (Fase 4, §7). El Host solo elige apariencia: lo que se
 * prueba aquí es que llegue bien, que no se cuele nada inyectable, y que un
 * fallo de admin-api pinte la marca por defecto en vez de romper la página.
 */

const PUBLICADO = {
	hostname: 'meromero.com',
	brand_name: 'Mero Mero',
	is_default: false,
	theme: {
		logo_url: 'https://cdn.meromero.com/logo.png',
		logo_dark_url: 'https://cdn.meromero.com/logo-blanco.png',
		favicon_url: 'https://cdn.meromero.com/favicon.png',
		legal_url: 'https://meromero.com/legal',
		support_email: 'soporte@meromero.com',
		tokens: {
			light: { '--color-brand-500': '#2563EB', '--color-brand-primary': '#1d4ed8' },
			dark: { '--color-brand-500': '#2563eb', '--color-brand-primary': '#3b82f6' }
		}
	}
};

function respuesta(cuerpo, status = 200) {
	return new Response(JSON.stringify(cuerpo), {
		status,
		headers: { 'content-type': 'application/json' }
	});
}

describe('marcaDesdeConfig', () => {
	it('la marca por defecto de admin-api es la por defecto aquí', () => {
		expect(marcaDesdeConfig({ is_default: true, brand_name: 'Nexus', theme: {} })).toBe(
			MARCA_POR_DEFECTO
		);
		expect(marcaDesdeConfig(null)).toBe(MARCA_POR_DEFECTO);
	});

	it('toma nombre, logos, enlaces y tokens de lo publicado', () => {
		const m = marcaDesdeConfig(PUBLICADO);
		expect(m).toMatchObject({
			name: 'Mero Mero',
			isDefault: false,
			logoUrl: 'https://cdn.meromero.com/logo.png',
			logoDarkUrl: 'https://cdn.meromero.com/logo-blanco.png',
			faviconUrl: 'https://cdn.meromero.com/favicon.png',
			legalUrl: 'https://meromero.com/legal',
			supportEmail: 'soporte@meromero.com'
		});
		expect(m.tokens.light['--color-brand-500']).toBe('#2563eb');
	});

	it('descarta URLs que no son https y tokens que no son color', () => {
		const m = marcaDesdeConfig({
			...PUBLICADO,
			theme: {
				logo_url: 'javascript:alert(1)',
				favicon_url: 'http://meromero.com/f.png',
				tokens: {
					light: {
						'--color-brand-500': 'red;}</style><script>x</script>',
						background: '#000000'
					},
					dark: { '--color-brand-500': '#2563eb' }
				}
			}
		});
		expect(m.logoUrl).toBeNull();
		expect(m.faviconUrl).toBeNull();
		expect(m.tokens.light).toEqual({});
		expect(m.tokens.dark).toEqual({ '--color-brand-500': '#2563eb' });
	});
});

describe('hostDeLaPeticion', () => {
	it('lee la cabecera Host, no event.url (que adapter-node fija a ORIGIN)', () => {
		// `Request` no deja fijar `host` a mano; el de adapter-node sí la trae.
		const request = { headers: { get: (k) => (k === 'host' ? 'App.MeroMero.com' : null) } };
		expect(hostDeLaPeticion(request, new URL('https://nexus.geminislabs.com/login'))).toBe(
			'app.meromero.com'
		);
	});
});

describe('resolverMarca', () => {
	beforeEach(() => _vaciarCache());

	it('pregunta a admin-api con el host del navegador en el parámetro', async () => {
		const f = vi.fn(async () => respuesta(PUBLICADO));
		const m = await resolverMarca('meromero.com', { apiBase: 'https://api/v1', fetch: f });

		expect(m.name).toBe('Mero Mero');
		expect(f.mock.calls[0][0]).toBe('https://api/v1/tenant-config?host=meromero.com');
	});

	it('recuerda la respuesta un minuto', async () => {
		let ahora = 0;
		const f = vi.fn(async () => respuesta(PUBLICADO));
		const opciones = { apiBase: 'https://api/v1', fetch: f, ahora: () => ahora };

		await resolverMarca('meromero.com', opciones);
		ahora = 59_000;
		await resolverMarca('meromero.com', opciones);
		expect(f).toHaveBeenCalledTimes(1);

		ahora = 61_000;
		await resolverMarca('meromero.com', opciones);
		expect(f).toHaveBeenCalledTimes(2);
	});

	it('si admin-api falla pinta la marca por defecto y vuelve a preguntar pronto', async () => {
		let ahora = 0;
		const f = vi.fn(async () => {
			throw new TypeError('fetch failed');
		});
		const opciones = { apiBase: 'https://api/v1', fetch: f, ahora: () => ahora };

		expect(await resolverMarca('meromero.com', opciones)).toBe(MARCA_POR_DEFECTO);
		ahora = 11_000;
		await resolverMarca('meromero.com', opciones);
		expect(f).toHaveBeenCalledTimes(2);
	});

	it('un 500 de admin-api también cae en la marca por defecto', async () => {
		const f = vi.fn(async () => respuesta({ detail: 'x' }, 500));
		expect(await resolverMarca('meromero.com', { apiBase: 'https://api/v1', fetch: f })).toBe(
			MARCA_POR_DEFECTO
		);
	});
});

describe('helpers de presentación', () => {
	const partner = marcaDesdeConfig(PUBLICADO);

	it('el título lleva la marca; la por defecto conserva NEXUS', () => {
		expect(tituloDe(partner, 'Iniciar sesión')).toBe('Mero Mero — Iniciar sesión');
		expect(tituloDe(MARCA_POR_DEFECTO, 'Iniciar sesión')).toBe('NEXUS — Iniciar sesión');
	});

	it('solo la marca por defecto nombra a GeminisLabs', () => {
		expect(descripcionDe(partner, 'Accede a')).not.toContain('GeminisLabs');
		expect(descripcionDe(MARCA_POR_DEFECTO, 'Accede a')).toContain('GeminisLabs');
	});

	it('el logo es el del partner, y en oscuro el oscuro si lo tiene', () => {
		expect(logoDe(partner)).toBe('https://cdn.meromero.com/logo.png');
		expect(logoDe(partner, { oscuro: true })).toBe('https://cdn.meromero.com/logo-blanco.png');
		expect(logoDe(MARCA_POR_DEFECTO)).not.toContain('meromero');
	});
});
