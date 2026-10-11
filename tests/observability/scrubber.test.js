import { describe, it, expect } from 'vitest';
import {
	scrubAttrs,
	scrubUrl,
	scrubHeaders,
	scrubMessage
} from '../../src/lib/observability/scrubber.js';

describe('scrubAttrs', () => {
	it("elimina 'password' case-insensitive", () => {
		expect(scrubAttrs({ password: 'x' }).password).toBe('[REDACTED]');
		expect(scrubAttrs({ Password: 'x' }).Password).toBe('[REDACTED]');
		expect(scrubAttrs({ PASSWORD: 'x' }).PASSWORD).toBe('[REDACTED]');
	});

	it("elimina 'authorization'", () => {
		expect(scrubAttrs({ authorization: 'Bearer x' }).authorization).toBe('[REDACTED]');
	});

	it("elimina 'token', 'access_token', 'refresh_token'", () => {
		expect(scrubAttrs({ token: 'a' }).token).toBe('[REDACTED]');
		expect(scrubAttrs({ access_token: 'a' }).access_token).toBe('[REDACTED]');
		expect(scrubAttrs({ refresh_token: 'a' }).refresh_token).toBe('[REDACTED]');
	});

	it("elimina 'jwt'", () => {
		expect(scrubAttrs({ jwt: 'eyJ' }).jwt).toBe('[REDACTED]');
	});

	it("elimina 'client_secret'", () => {
		expect(scrubAttrs({ client_secret: 'cs' }).client_secret).toBe('[REDACTED]');
	});

	it("elimina 'recaptcha_token'", () => {
		expect(scrubAttrs({ recaptcha_token: 'tok' }).recaptcha_token).toBe('[REDACTED]');
	});

	it("elimina 'email', 'phone', 'name'", () => {
		expect(scrubAttrs({ email: 'a@b.c' }).email).toBe('[REDACTED]');
		expect(scrubAttrs({ phone: '55' }).phone).toBe('[REDACTED]');
		expect(scrubAttrs({ name: 'Ada' }).name).toBe('[REDACTED]');
	});

	it('elimina lat, lng, latitude, longitude, contraseñas y authorization', () => {
		const out = scrubAttrs({
			lat: 19.4,
			lng: -99.1,
			latitude: 19.4,
			longitude: -99.1,
			password: 'secret',
			authorization: 'Bearer abc',
			note: 'escribir a ada@example.com'
		});
		expect(out.lat).toBe('[REDACTED]');
		expect(out.lng).toBe('[REDACTED]');
		expect(out.latitude).toBe('[REDACTED]');
		expect(out.longitude).toBe('[REDACTED]');
		expect(out.password).toBe('[REDACTED]');
		expect(out.authorization).toBe('[REDACTED]');
		expect(out.note).not.toContain('ada@example.com');
		expect(out.note).toContain('[REDACTED]');
	});

	it("no elimina 'service.name', 'http.method', 'http.status_code'", () => {
		const out = scrubAttrs({
			'service.name': 'nexus-web-page',
			'http.method': 'POST',
			'http.status_code': 200
		});
		expect(out['service.name']).toBe('nexus-web-page');
		expect(out['http.method']).toBe('POST');
		expect(out['http.status_code']).toBe(200);
	});

	it('recursión en objetos anidados', () => {
		const out = scrubAttrs({ http: { token: 'secret', method: 'GET' } });
		expect(out.http).toMatchObject({ token: '[REDACTED]', method: 'GET' });
	});

	it('no muta el objeto original', () => {
		const input = { password: 'x', ok: 1 };
		scrubAttrs(input);
		expect(input.password).toBe('x');
	});

	it('si el scrubber falla internamente, retorna {}', () => {
		const boom = {
			get password() {
				throw new Error('fail');
			}
		};
		expect(scrubAttrs(boom)).toEqual({});
	});

	it('valor null en una key no throw y conserva la key', () => {
		expect(() => scrubAttrs({ http_status_code: null })).not.toThrow();
		const out = scrubAttrs({ http_status_code: null, password: null });
		expect(out).toHaveProperty('http_status_code');
		expect(out.http_status_code).toBeNull();
		expect(out.password).toBe('[REDACTED]');
	});

	it('valor array se maneja sin throw', () => {
		expect(() => scrubAttrs(['a', 'b'])).not.toThrow();
		expect(scrubAttrs(['a', 'b'])).toEqual({});
		const nested = scrubAttrs({
			items: [1, 'ok', { token: 'secret' }, null]
		});
		expect(nested.items).toEqual([1, 'ok', { token: '[REDACTED]' }, null]);
	});

	it('objeto circular no throw; depth-limit en lugar de {}', () => {
		const circular = /** @type {Record<string, unknown>} */ ({ ok: 1 });
		circular.self = circular;
		expect(() => scrubAttrs(circular)).not.toThrow();
		const out = scrubAttrs(circular);
		expect(out).not.toEqual({});
		expect(out.ok).toBe(1);
	});

	it('funciones y símbolos se redactan', () => {
		const out = scrubAttrs({
			fn: () => 1,
			sym: Symbol('x'),
			big: 1n
		});
		expect(out.fn).toBe('[REDACTED]');
		expect(out.sym).toBe('[REDACTED]');
		expect(out.big).toBe('[REDACTED]');
	});

	it('profundidad mayor a 8 se redacta', () => {
		let cur = /** @type {Record<string, unknown>} */ ({ leaf: 'ok' });
		for (let i = 0; i < 12; i += 1) {
			cur = { child: cur };
		}
		const out = scrubAttrs(cur);
		expect(JSON.stringify(out)).toContain('[REDACTED]');
	});
});

describe('scrubUrl', () => {
	it('deja path sin query', () => {
		expect(scrubUrl('/api/v1/auth/login')).toBe('/api/v1/auth/login');
	});

	it('elimina token de verify-email', () => {
		expect(scrubUrl('/verify-email?token=SECRET')).toBe('/verify-email');
	});

	it('elimina token, lat y lng del query', () => {
		expect(scrubUrl('/api/v1/communications/latest?device_ids=1&token=SECRET&lat=19&lng=-99')).toBe(
			'/api/v1/communications/latest'
		);
		expect(scrubMessage('user ada@example.com?token=SECRET')).not.toContain('ada@example.com');
		expect(scrubMessage('user ada@example.com?token=SECRET')).not.toContain('SECRET');
	});

	it('elimina query de accept-invitation', () => {
		expect(scrubUrl('/accept-invitation?key=ABC&org=123')).toBe('/accept-invitation');
	});

	it('URL completa con query → origen + path', () => {
		expect(scrubUrl('https://geminislabs.com/verify-email?token=SECRET')).toBe(
			'https://geminislabs.com/verify-email'
		);
	});

	it('URL sin path (solo origen) no throw', () => {
		expect(() => scrubUrl('https://geminislabs.com')).not.toThrow();
		expect(scrubUrl('https://geminislabs.com')).toBe('https://geminislabs.com');
		expect(scrubUrl('https://geminislabs.com/')).toBe('https://geminislabs.com/');
	});

	it('si String(url) throw, retorna string vacío', () => {
		const boom = {
			toString() {
				throw new Error('bad url');
			}
		};
		expect(scrubUrl(boom)).toBe('');
	});
});

describe('scrubHeaders', () => {
	it("elimina 'Authorization'", () => {
		expect(
			scrubHeaders({ Authorization: 'Bearer abc', 'Content-Type': 'application/json' })
		).toEqual({
			'Content-Type': 'application/json'
		});
	});

	it("elimina 'Cookie'", () => {
		expect(scrubHeaders({ Cookie: 'a=1', 'X-Request-ID': 'r1' })).toEqual({
			'X-Request-ID': 'r1'
		});
	});

	it('conserva Content-Type, X-Request-ID, traceparent', () => {
		const out = scrubHeaders({
			'Content-Type': 'application/json',
			'X-Request-ID': 'abc',
			traceparent: '00-aa-bb-01'
		});
		expect(out['Content-Type']).toBe('application/json');
		expect(out['X-Request-ID']).toBe('abc');
		expect(out.traceparent).toBe('00-aa-bb-01');
	});

	it('Headers vacío retorna objeto vacío sin throw', () => {
		expect(() => scrubHeaders(new Headers())).not.toThrow();
		expect(scrubHeaders(new Headers())).toEqual({});
	});

	it('null o no-objeto retorna objeto vacío', () => {
		expect(scrubHeaders(null)).toEqual({});
		expect(scrubHeaders('nope')).toEqual({});
	});

	it('si leer headers throw, retorna {}', () => {
		const boom = {
			get Authorization() {
				throw new Error('header boom');
			}
		};
		expect(scrubHeaders(boom)).toEqual({});
	});
});

describe('scrubMessage', () => {
	it('trunca a 300 chars', () => {
		expect(scrubMessage('a'.repeat(400))).toHaveLength(300);
	});

	it('corta en ?', () => {
		expect(scrubMessage('/verify-email?token=SECRET')).toBe('/verify-email');
	});

	it('mensaje sin query no cambia (salvo truncado)', () => {
		expect(scrubMessage('ok')).toBe('ok');
	});

	it("string con '?' en posición 0 queda vacío", () => {
		expect(scrubMessage('?token=SECRET')).toBe('');
	});

	it('si String(msg) throw, retorna string vacío', () => {
		const boom = {
			toString() {
				throw new Error('bad msg');
			}
		};
		expect(scrubMessage(boom)).toBe('');
	});
});

describe('scrubStack', () => {
	it('quita cada query pero conserva los marcos siguientes', async () => {
		const { scrubStack, scrubMessage } = await import('../../src/lib/observability/scrubber.js');
		const stack =
			'Error: x\n    at f (https://sitio.test/app.js?token=SECRETO:1:1)\n    at g (/app/src/b.js:2:2)';

		const limpio = scrubStack(stack);

		expect(limpio).not.toContain('SECRETO');
		expect(limpio).toContain('https://sitio.test/app.js');
		// Lo que `scrubMessage` se llevaba por delante: el resto del stack.
		expect(limpio).toContain('/app/src/b.js:2:2');
		expect(scrubMessage(stack)).not.toContain('/app/src/b.js:2:2');
	});

	it('deja sitio para el stack, que con 300 caracteres no servía', async () => {
		const { scrubStack, scrubMessage } = await import('../../src/lib/observability/scrubber.js');
		const largo = 'at f (/app/src/muy/larga/ruta/modulo.js:120:8)\n'.repeat(60);

		expect(scrubMessage(largo).length).toBe(300);
		expect(scrubStack(largo).length).toBeGreaterThan(2000);
		expect(scrubStack('x'.repeat(20_000)).length).toBe(8_000);
	});
});
