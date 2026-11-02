import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
	MARCA_POR_DEFECTO,
	_vaciarCache,
	hostDeLaPeticion,
	marcaDesdeConfig,
	resolverMarca
} from '../src/lib/server/brand.js';
import { descripcionDe, estiloDeMarca, logoDe, tituloDe } from '../src/lib/brand.js';

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

/**
 * Opción B: el partner sobrescribe solo los `--color-brand-*`; con Nexus no se
 * inyecta nada y la página queda exactamente como la define `app.css`.
 */
describe('estiloDeMarca', () => {
	it('con la marca por defecto no inyecta nada', () => {
		expect(estiloDeMarca(null)).toBe('');
		expect(estiloDeMarca(MARCA_POR_DEFECTO)).toBe('');
	});

	it('un partner sin tokens tampoco', () => {
		expect(estiloDeMarca({ ...marcaDesdeConfig(PUBLICADO), tokens: null })).toBe('');
	});

	it('sobrescribe claro y oscuro por separado, con más especificidad que :root', () => {
		const css = estiloDeMarca(marcaDesdeConfig(PUBLICADO));
		expect(css).toContain('html:root{');
		expect(css).toContain('html.dark:root{');
		const [claro, oscuro] = css.split('html.dark:root');
		expect(claro).toContain('--color-brand-primary:#1d4ed8');
		expect(oscuro).toContain('--color-brand-primary:#3b82f6');
	});

	it('deriva el botón principal de primary y accent', () => {
		const css = estiloDeMarca({
			name: 'Mero Mero',
			isDefault: false,
			tokens: {
				light: {
					'--color-brand-primary': '#2563eb',
					'--color-brand-accent': '#7c3aed',
					'--color-brand-on-primary': '#ffffff',
					'--color-brand-400': '#6b9dff'
				},
				dark: { '--color-brand-primary': '#4883ff' }
			}
		});
		const [claro, oscuro] = css.split('html.dark:root');
		expect(claro).toContain('--color-brand-cta-from:#7c3aed');
		expect(claro).toContain('--color-brand-cta-to:#2563eb');
		expect(claro).toContain('--color-brand-on-cta:#ffffff');
		expect(claro).toContain('--color-brand-glow:#6b9dff');
		// Sin accent ni rampa, todo sale del primary.
		expect(oscuro).toContain('--color-brand-cta-from:#4883ff');
		expect(oscuro).toContain('--color-brand-glow:#4883ff');
	});

	it('deriva enlace, foco y manchas del acceso según el modo', () => {
		const css = estiloDeMarca({
			name: 'Mero Mero',
			isDefault: false,
			tokens: {
				light: {
					'--color-brand-primary': '#2563eb',
					'--color-brand-link': '#1e40af',
					'--color-brand-100': '#e0eaff',
					'--color-brand-200': '#c2d5ff',
					'--color-brand-300': '#9bbaff',
					'--color-brand-500': '#3b74f6'
				},
				dark: {
					'--color-brand-primary': '#4883ff',
					'--color-brand-900': '#1a2b5c',
					'--color-brand-950': '#0f1938'
				}
			}
		});
		const [claro, oscuro] = css.split('html.dark:root');
		// El enlace que publica el partner gana; el foco sale de la rampa.
		expect(claro).toContain('--color-brand-link:#1e40af');
		expect(claro).toContain('--color-brand-focus:#3b74f6');
		expect(claro).toContain('--color-brand-aura-1:#c2d5ff');
		expect(claro).toContain('--color-brand-aura-2:#e0eaff');
		expect(claro).toContain('--color-brand-aura-3:#9bbaff');
		// Sin `link` ni 500 en oscuro, los dos salen del primary.
		expect(oscuro).toContain('--color-brand-link:#4883ff');
		expect(oscuro).toContain('--color-brand-focus:#4883ff');
		expect(oscuro).toContain('--color-brand-aura-1:#1a2b5c');
		expect(oscuro).toContain('--color-brand-aura-2:#0f1938');
		expect(oscuro).toContain('--color-brand-aura-3:#1a2b5c');
	});

	it('pinta las otras familias de identidad con la rampa del partner, paso por paso', () => {
		const css = estiloDeMarca({
			name: 'Mero Mero',
			isDefault: false,
			tokens: {
				light: { '--color-brand-500': '#3b74f6', '--color-brand-700': '#1d3fa8' },
				dark: {}
			}
		});
		for (const familia of ['sky', 'cyan', 'blue', 'teal', 'green']) {
			expect(css).toContain(`--color-brand-${familia}-500:#3b74f6`);
			expect(css).toContain(`--color-brand-${familia}-700:#1d3fa8`);
			// Un paso que el partner no publica no se inventa: queda el de Nexus.
			expect(css).not.toContain(`--color-brand-${familia}-300`);
		}
	});

	it('deriva la barra de pestañas y el avatar', () => {
		const css = estiloDeMarca({
			name: 'Mero Mero',
			isDefault: false,
			tokens: {
				light: {
					'--color-brand-primary': '#2563eb',
					'--color-brand-link': '#1e40af',
					'--color-brand-700': '#1d3fa8'
				},
				dark: { '--color-brand-primary': '#4883ff' }
			}
		});
		const [claro, oscuro] = css.split('html.dark:root');
		// La pestaña activa es texto: usa el `link`, que ya pasó el contraste.
		expect(claro).toContain('--color-brand-nav:#1e40af');
		expect(claro).toContain('--color-brand-nav-bar:#2563eb');
		expect(claro).toContain('--color-brand-deep:#1d3fa8');
		expect(oscuro).toContain('--color-brand-nav:#4883ff');
		expect(oscuro).toContain('--color-brand-deep:#4883ff');
	});

	it('no deja pasar nada que pueda cerrar la etiqueta o colar otra regla', () => {
		const css = estiloDeMarca({
			name: 'X',
			isDefault: false,
			tokens: {
				light: {
					'--color-brand-primary': '#2563eb;}</style><script>alert(1)</script>',
					'--color-brand-500': 'red',
					'--otra-cosa': '#ffffff',
					'--color-brand-600': '#123456'
				},
				dark: {}
			}
		});
		expect(css).not.toMatch(/[<>]/);
		// Solo un bloque, y dentro solo variables de marca con un hex: el 600 y lo que
		// el mapa deriva de él.
		const [, cuerpo] = css.match(/^html:root\{([^{}]*)\}$/) ?? [];
		const decls = cuerpo.split(';');
		expect(decls).toContain('--color-brand-600:#123456');
		expect(decls).toContain('--color-brand-sky-600:#123456');
		for (const d of decls) expect(d).toMatch(/^--color-brand-[a-z0-9-]+:#[0-9a-f]{6}$/);
	});
});
