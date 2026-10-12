import { describe, it, expect } from 'vitest';
import {
	DEFAULT_PRIMARY,
	describeAdjustment,
	describeLastPublished,
	describePair,
	draftPayload,
	emptyBrandForm,
	fieldErrorsFromApi,
	formFromBranding,
	isHexColor,
	previewTokens,
	rampFromTokens,
	safeCssVars,
	sameBrandForm,
	urlProblem,
	validateBrandForm
} from '../src/lib/utils/brandForm.js';

const DRAFT = {
	version: 1,
	brand_name: 'Rastreo Norte',
	logo_url: 'https://norte.mx/logo.png',
	logo_dark_url: 'https://norte.mx/logo-blanco.png',
	support_email: 'soporte@norte.mx',
	legal_url: 'https://norte.mx/legal',
	seed: { primary: '#0E7490', accent: '#f59e0b' },
	tokens: {
		light: { '--color-brand-500': '#0e7490', '--color-brand-primary': '#0e7490' },
		dark: { '--color-brand-500': '#22d3ee', '--color-brand-primary': '#22d3ee' }
	}
};

const PUBLISHED = {
	version: 1,
	logo_url: 'https://norte.mx/viejo.png',
	support_email: 'hola@norte.mx',
	legal_url: 'https://norte.mx/legal',
	seed: { primary: '#1d4ed8' },
	tokens: { light: { '--color-brand-primary': '#1d4ed8' }, dark: {} }
};

/** @param {Partial<ReturnType<typeof emptyBrandForm>>} overrides */
function validForm(overrides = {}) {
	return {
		...emptyBrandForm(),
		brand_name: 'Rastreo Norte',
		logo_url: 'https://norte.mx/logo.png',
		support_email: 'soporte@norte.mx',
		legal_url: 'https://norte.mx/legal',
		...overrides
	};
}

describe('formFromBranding: qué se edita al abrir la pantalla', () => {
	it('sin fila: formulario en blanco con el color por defecto', () => {
		const { form, source } = formFromBranding({ account_id: 'acc-1' });
		expect(source).toBe('empty');
		expect(form).toEqual(emptyBrandForm());
		expect(form.primary).toBe(DEFAULT_PRIMARY);
	});

	it('con borrador: se edita el borrador, aunque haya algo publicado', () => {
		const { form, source } = formFromBranding({
			brand_name: 'Viejo',
			draft: DRAFT,
			published: PUBLISHED
		});
		expect(source).toBe('draft');
		expect(form.brand_name).toBe('Rastreo Norte');
		expect(form.logo_dark_url).toBe('https://norte.mx/logo-blanco.png');
		expect(form.primary).toBe('#0e7490');
		expect(form).toMatchObject({ useAccent: true, accent: '#f59e0b' });
	});

	it('sin borrador: copia lo publicado, con el nombre de la columna', () => {
		const { form, source } = formFromBranding({
			brand_name: 'Norte Publicado',
			draft: null,
			published: PUBLISHED
		});
		expect(source).toBe('published');
		expect(form.brand_name).toBe('Norte Publicado');
		expect(form.logo_url).toBe('https://norte.mx/viejo.png');
		expect(form.useAccent).toBe(false);
		expect(form.logo_dark_url).toBe('');
	});

	it('published vacío cuenta como nada publicado, pero conserva el nombre', () => {
		const { form, source } = formFromBranding({ brand_name: 'Solo nombre', published: {} });
		expect(source).toBe('empty');
		expect(form.brand_name).toBe('Solo nombre');
	});

	it('una semilla que no es hex se ignora', () => {
		const { form } = formFromBranding({ draft: { ...DRAFT, seed: { primary: 'red' } } });
		expect(form.primary).toBe(DEFAULT_PRIMARY);
		expect(form.useAccent).toBe(false);
	});
});

describe('draftPayload: el cuerpo de PUT /branding/draft', () => {
	it('omite los opcionales vacíos y recorta espacios', () => {
		expect(draftPayload(validForm({ brand_name: '  Norte  ', logo_dark_url: '   ' }))).toEqual({
			brand_name: 'Norte',
			logo_url: 'https://norte.mx/logo.png',
			support_email: 'soporte@norte.mx',
			legal_url: 'https://norte.mx/legal',
			seed: { primary: DEFAULT_PRIMARY }
		});
	});

	it('manda el acento solo si está activado', () => {
		expect(draftPayload(validForm({ accent: '#F59E0B', useAccent: false })).seed).toEqual({
			primary: DEFAULT_PRIMARY
		});
		expect(draftPayload(validForm({ accent: '#F59E0B', useAccent: true })).seed).toEqual({
			primary: DEFAULT_PRIMARY,
			accent: '#f59e0b'
		});
	});

	it('nunca manda tokens ni version: los pone el servidor', () => {
		const payload = draftPayload(formFromBranding({ draft: DRAFT }).form);
		expect(payload).not.toHaveProperty('tokens');
		expect(payload).not.toHaveProperty('version');
	});

	it('ida y vuelta: lo que se guarda es lo que se vuelve a cargar', () => {
		const form = formFromBranding({ draft: DRAFT }).form;
		const reloaded = formFromBranding({ draft: { ...draftPayload(form), tokens: {} } }).form;
		expect(sameBrandForm(form, reloaded)).toBe(true);
	});
});

describe('sameBrandForm: cambios sin guardar', () => {
	it('espacios alrededor no cuentan como cambio', () => {
		expect(sameBrandForm(validForm(), validForm({ brand_name: ' Rastreo Norte ' }))).toBe(true);
	});

	it('el acento apagado no cuenta aunque tenga valor', () => {
		expect(sameBrandForm(validForm(), validForm({ accent: '#ffffff' }))).toBe(true);
	});

	it('un cambio real sí cuenta', () => {
		expect(sameBrandForm(validForm(), validForm({ primary: '#000000' }))).toBe(false);
		expect(sameBrandForm(validForm(), validForm({ favicon_url: 'https://norte.mx/f.png' }))).toBe(
			false
		);
	});
});

describe('urlProblem: la misma regla que validar_url_publica', () => {
	it.each([
		['https://norte.mx/logo.png', null],
		['https://cdn.norte.mx:8443/a/b.svg?v=2', null],
		['https://norte.mx./logo.png', null]
	])('acepta %s', (url, expected) => {
		expect(urlProblem(url)).toBe(expected);
	});

	it.each([
		['http://norte.mx/logo.png', 'https://'],
		['ftp://norte.mx/logo.png', 'https://'],
		['https://user:pw@norte.mx/logo.png', 'usuario'],
		['https://user@norte.mx/logo.png', 'usuario'],
		['https://localhost/logo.png', 'localhost'],
		['https://app.localhost/logo.png', 'localhost'],
		['https://169.254.169.254/latest', 'IP'],
		['https://10.8.0.1/logo.png', 'IP'],
		['https://[::1]/logo.png', 'IP'],
		['https://intranet/logo.png', 'dominio'],
		['logo.png', 'URL válida'],
		[`https://norte.mx/${'a'.repeat(2048)}`, '2048']
	])('rechaza %s', (url, fragment) => {
		expect(urlProblem(url)).toContain(fragment);
	});
});

describe('validateBrandForm', () => {
	it('un formulario completo no tiene errores', () => {
		expect(validateBrandForm(validForm())).toEqual({});
	});

	it('marca los obligatorios vacíos', () => {
		const errors = validateBrandForm(emptyBrandForm());
		expect(Object.keys(errors).sort()).toEqual(
			['brand_name', 'legal_url', 'logo_url', 'support_email'].sort()
		);
	});

	it('los opcionales vacíos pasan, pero si se llenan se validan', () => {
		expect(validateBrandForm(validForm({ favicon_url: '' }))).toEqual({});
		expect(validateBrandForm(validForm({ favicon_url: 'http://norte.mx/f.png' }))).toHaveProperty(
			'favicon_url'
		);
	});

	it('nombre largo, correo sin dominio y colores mal escritos', () => {
		const errors = validateBrandForm(
			validForm({
				brand_name: 'x'.repeat(81),
				support_email: 'soporte@norte',
				primary: '#12345',
				useAccent: true,
				accent: 'azul'
			})
		);
		expect(Object.keys(errors).sort()).toEqual(
			['accent', 'brand_name', 'primary', 'support_email'].sort()
		);
	});

	it('el acento apagado no se valida', () => {
		expect(validateBrandForm(validForm({ useAccent: false, accent: 'azul' }))).toEqual({});
	});
});

describe('fieldErrorsFromApi: el 422 del servidor, por campo', () => {
	it('no es un 422: null, para que la pantalla muestre el mensaje genérico', () => {
		expect(fieldErrorsFromApi({ status: 403, detail: 'x' })).toBeNull();
		expect(fieldErrorsFromApi(null)).toBeNull();
	});

	it('traduce la lista de Pydantic, incluida la semilla anidada', () => {
		const result = fieldErrorsFromApi({
			status: 422,
			detail: [
				{ loc: ['body', 'logo_url'], msg: 'Value error, la URL debe empezar con https://' },
				{ loc: ['body', 'seed', 'primary'], msg: 'Value error, el color debe ser hexadecimal' },
				{ loc: ['body', 'support_email'], msg: 'value is not a valid email address' },
				{ loc: ['body', 'brand_name'], msg: 'String should have at most 80 characters' },
				{ loc: ['body', 'campo_raro'], msg: 'Extra inputs are not permitted' }
			]
		});
		expect(result).toEqual({
			fields: {
				logo_url: 'La URL debe empezar con https://',
				primary: 'El color debe ser hexadecimal',
				support_email: 'No es un correo válido.',
				brand_name: 'Entre 1 y 80 caracteres.'
			},
			contrast: []
		});
	});

	it('el mensaje en inglés de Pydantic no llega a la pantalla', () => {
		const result = fieldErrorsFromApi({
			status: 422,
			detail: [{ loc: ['body', 'legal_url'], msg: 'Field required' }]
		});
		expect(result?.fields.legal_url).toBe('Valor no válido.');
	});

	it('el 422 de contraste devuelve los pares', () => {
		const pairs = [{ modo: 'light', par: 'on-primary/primary', ratio: 3.1, minimo: 4.5 }];
		expect(
			fieldErrorsFromApi({
				status: 422,
				detail: { code: 'contraste_insuficiente', message: 'x', pairs }
			})
		).toEqual({ fields: {}, contrast: pairs });
	});
});

describe('textos para el usuario', () => {
	it('describeAdjustment', () => {
		expect(
			describeAdjustment({
				modo: 'light',
				token: '--color-brand-primary',
				semilla: '#ffeb3b',
				usado: '#a18800'
			})
		).toBe(
			'En modo claro, el color primario #ffeb3b no contrasta lo suficiente con el fondo; se usa #a18800.'
		);
	});

	it('describePair', () => {
		expect(describePair({ modo: 'dark', par: 'link/fondo', ratio: 3.2, minimo: 4.5 })).toBe(
			'En modo oscuro, «link/fondo» tiene contraste 3.2:1 y necesita 4.5:1.'
		);
	});

	it('describeLastPublished distingue si publicaste tú', () => {
		const branding = { published_at: '2026-10-12T16:30:00Z', published_by: 'u-1' };
		expect(describeLastPublished(branding, 'u-1')).toMatch(/^Publicado el .+ por ti$/);
		expect(describeLastPublished(branding, 'u-2')).toMatch(/por otro administrador$/);
		expect(describeLastPublished({ published_at: '2026-10-12T16:30:00Z' }, 'u-1')).toMatch(
			/^Publicado el [^p]+$/
		);
	});

	it('describeLastPublished: nunca publicado o fecha rota', () => {
		expect(describeLastPublished({ published_at: null }, 'u-1')).toBeNull();
		expect(describeLastPublished({ published_at: 'no-es-fecha' }, 'u-1')).toBeNull();
		expect(describeLastPublished(null, 'u-1')).toBeNull();
	});
});

describe('tokens para la previsualización', () => {
	it('previewTokens prefiere el borrador y cae a lo publicado', () => {
		expect(previewTokens({ draft: DRAFT, published: PUBLISHED }, 'dark')).toEqual(
			DRAFT.tokens.dark
		);
		expect(previewTokens({ draft: null, published: PUBLISHED }, 'light')).toEqual(
			PUBLISHED.tokens.light
		);
		expect(previewTokens({ draft: null, published: {} }, 'light')).toBeNull();
	});

	it('rampFromTokens ordena 50…950 y salta lo que falte', () => {
		expect(
			rampFromTokens({
				'--color-brand-900': '#111111',
				'--color-brand-50': '#fafafa',
				'--color-brand-500': 'no-hex'
			})
		).toEqual([
			{ step: 50, color: '#fafafa' },
			{ step: 900, color: '#111111' }
		]);
		expect(rampFromTokens(null)).toEqual([]);
	});

	it('safeCssVars solo deja pasar --color-brand-* con un #rrggbb', () => {
		expect(
			safeCssVars({
				'--color-brand-primary': '#0e7490',
				'--color-brand-link': 'red; background: url(https://x)',
				'--otra-cosa': '#ffffff',
				color: '#ffffff'
			})
		).toEqual([['--color-brand-primary', '#0e7490']]);
		expect(safeCssVars(null)).toEqual([]);
	});

	it('isHexColor', () => {
		expect(isHexColor('#0E7490')).toBe(true);
		expect(isHexColor('#fff')).toBe(false);
		expect(isHexColor(null)).toBe(false);
	});
});
