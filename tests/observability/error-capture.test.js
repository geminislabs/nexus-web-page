import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { logs, SeverityNumber } from '@opentelemetry/api-logs';
import { metrics } from '@opentelemetry/api';
import {
	reportUnhandled,
	classifyError,
	installBrowserErrorCapture,
	installNodeErrorCapture,
	logWarn,
	logError
} from '../../src/lib/observability/capture.js';

describe('error capture', () => {
	/** @type {ReturnType<typeof vi.fn>} */
	let emit;
	/** @type {ReturnType<typeof vi.fn>} */
	let add;

	beforeEach(() => {
		emit = vi.fn();
		add = vi.fn();
		vi.spyOn(logs, 'getLogger').mockReturnValue({ emit });
		vi.spyOn(metrics, 'getMeter').mockReturnValue({
			createCounter: () => ({ add })
		});
	});

	afterEach(() => {
		vi.restoreAllMocks();
	});

	it('unhandledrejection emite logger.error con error_category', () => {
		reportUnhandled(new TypeError('x is not a function'));
		expect(emit).toHaveBeenCalledWith(
			expect.objectContaining({
				severityNumber: SeverityNumber.ERROR,
				severityText: 'ERROR',
				attributes: expect.objectContaining({ error_category: 'programming' })
			})
		);
		expect(add).toHaveBeenCalledWith(1, expect.objectContaining({ error_category: 'programming' }));
	});

	it('error.message pasa por scrubber antes de emitir', () => {
		reportUnhandled(new Error('/verify-email?token=SECRET boom'));
		const body = emit.mock.calls[0][0].body;
		expect(String(body)).not.toContain('token=SECRET');
		expect(String(body)).toContain('/verify-email');
	});

	it('error.stack pasa por scrubber antes de emitir', () => {
		const err = new Error('fail');
		err.stack = 'Error: fail\n    at /accept-invitation?token=SECRET:1:1';
		reportUnhandled(err);
		expect(JSON.stringify(emit.mock.calls[0][0])).not.toContain('token=SECRET');
	});

	it("stack trace con '?token=SECRET' → scrubbed", () => {
		const err = new Error('x');
		err.stack = 'https://app.local/verify-email?token=SECRET';
		reportUnhandled(err);
		expect(JSON.stringify(emit.mock.calls[0][0])).not.toContain('SECRET');
	});

	it('classifyError mapea AbortError a timeout', () => {
		const err = new Error('aborted');
		err.name = 'AbortError';
		expect(classifyError(err)).toBe('timeout');
	});

	it('error capture no throw', () => {
		expect(() => reportUnhandled(undefined)).not.toThrow();
		expect(() => reportUnhandled('string-error')).not.toThrow();
	});

	it('installBrowserErrorCapture observa window events', () => {
		installBrowserErrorCapture();
		window.dispatchEvent(new ErrorEvent('error', { error: new TypeError('from window') }));
		expect(
			emit.mock.calls.some((call) => call[0].attributes?.error_category === 'programming')
		).toBe(true);
	});

	it('window.onerror reporta error o message', () => {
		installBrowserErrorCapture();
		window.onerror('msg only', 'src.js', 1, 1, undefined);
		window.onerror('ignored', 'src.js', 1, 1, new TypeError('from onerror'));
		expect(emit.mock.calls.length).toBeGreaterThan(0);
	});

	it('unhandledrejection usa reason', () => {
		installBrowserErrorCapture();
		const event = new Event('unhandledrejection');
		Object.defineProperty(event, 'reason', { value: new TypeError('rejected') });
		window.dispatchEvent(event);
		expect(emit.mock.calls.some((call) => String(call[0].body).includes('rejected'))).toBe(true);
	});

	it('ErrorEvent sin error usa message', () => {
		installBrowserErrorCapture();
		window.dispatchEvent(new ErrorEvent('error', { message: 'no error object' }));
		expect(emit.mock.calls.some((call) => String(call[0].body).includes('no error object'))).toBe(
			true
		);
	});

	it('deduplica el mismo objeto Error', () => {
		const err = new TypeError('dup');
		reportUnhandled(err);
		reportUnhandled(err);
		expect(emit).toHaveBeenCalledTimes(1);
	});

	it('classifyError mapea TimeoutError a timeout', () => {
		const err = new Error('timed out');
		err.name = 'TimeoutError';
		expect(classifyError(err)).toBe('timeout');
		expect(classifyError(null)).toBe('programming');
		expect(classifyError('x')).toBe('programming');
	});

	it('uncaughtException reporta y devuelve el proceso a morir', () => {
		installNodeErrorCapture();
		const uncaught = process
			.listeners('uncaughtException')
			.find((fn) => String(fn).includes('reportUnhandled'));
		expect(uncaught).toBeTruthy();

		const exit = vi.spyOn(process, 'exit').mockImplementation(() => undefined);
		vi.spyOn(console, 'error').mockImplementation(() => undefined);

		uncaught(new TypeError('node boom'));

		expect(emit).toHaveBeenCalled();
		// Lo que fija esta prueba: registrar el listener anula el default de Node
		// (imprimir y morir), asi que el default se devuelve a mano. Sin esto el
		// servidor sigue atendiendo con estado indefinido en vez de reiniciarse.
		expect(exit).toHaveBeenCalledWith(1);
	});

	it('unhandledRejection vuelve a lanzar para que Node haga lo suyo', () => {
		installNodeErrorCapture();
		const rejection = process
			.listeners('unhandledRejection')
			.find((fn) => String(fn).includes('reportUnhandled'));
		expect(rejection).toBeTruthy();

		expect(() => rejection(new Error('node rej'))).toThrow('node rej');
		expect(() => rejection('texto suelto')).toThrow('texto suelto');
		expect(emit).toHaveBeenCalledTimes(2);
	});

	it('logWarn y logError emiten severidad correcta', () => {
		logWarn('auth.store.error', { error_category: 'programming' });
		logError('dependency.recaptcha.failure', { error_category: 'dependency' });
		expect(emit).toHaveBeenCalledWith(
			expect.objectContaining({ severityText: 'WARN', body: 'auth.store.error' })
		);
		expect(emit).toHaveBeenCalledWith(
			expect.objectContaining({
				severityText: 'ERROR',
				body: 'dependency.recaptcha.failure'
			})
		);
	});

	it('fail-open si el logger throw', () => {
		vi.spyOn(logs, 'getLogger').mockImplementation(() => {
			throw new Error('logs down');
		});
		expect(() => reportUnhandled(new Error('x'))).not.toThrow();
		expect(() => logWarn('x')).not.toThrow();
	});
});
