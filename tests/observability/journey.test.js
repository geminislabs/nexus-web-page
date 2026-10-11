import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { metrics, trace } from '@opentelemetry/api';
import {
	startJourney,
	getCurrentJourneyContext,
	recordJourneyOutcome,
	recordJsError
} from '../../src/lib/observability/journey.js';

describe('journey', () => {
	/** @type {ReturnType<typeof vi.fn>} */
	let add;
	/** @type {ReturnType<typeof vi.fn>} */
	let spanEnd;
	/** @type {ReturnType<typeof vi.fn>} */
	let startSpan;
	/** @type {ReturnType<typeof vi.fn>} */
	let setAttribute;
	/** @type {ReturnType<typeof vi.fn>} */
	let setStatus;

	beforeEach(() => {
		add = vi.fn();
		spanEnd = vi.fn();
		setAttribute = vi.fn();
		setStatus = vi.fn();
		startSpan = vi.fn(() => ({
			spanContext: () => ({
				traceId: 'a'.repeat(32),
				spanId: 'b'.repeat(16),
				traceFlags: 1
			}),
			setAttribute,
			setStatus,
			end: spanEnd
		}));
		vi.spyOn(metrics, 'getMeter').mockReturnValue({
			createCounter: () => ({ add })
		});
		vi.spyOn(trace, 'getTracer').mockReturnValue({ startSpan });
	});

	afterEach(() => {
		vi.restoreAllMocks();
	});

	it('startJourney retorna handle con traceId, spanId y end()', () => {
		const handle = startJourney('auth.login');
		expect(handle.traceId).toBe('a'.repeat(32));
		expect(handle.spanId).toBe('b'.repeat(16));
		expect(typeof handle.end).toBe('function');
		expect(startSpan).toHaveBeenCalled();
	});

	it('end() incrementa journey_outcome_total y cierra el span', () => {
		startJourney('auth.login').end('success');
		expect(add).toHaveBeenCalledWith(
			1,
			expect.objectContaining({
				journey: 'auth.login',
				outcome: 'success',
				service_name: 'nexus-web-page',
				deployment_environment: 'local'
			})
		);
		expect(spanEnd).toHaveBeenCalled();
		expect(setAttribute).toHaveBeenCalledWith('outcome', 'success');
	});

	it('end() con failure registra error_category y status ERROR', () => {
		startJourney('auth.login').end('failure', { error_category: 'user' });
		expect(add).toHaveBeenCalledWith(
			1,
			expect.objectContaining({
				journey: 'auth.login',
				outcome: 'failure',
				error_category: 'user'
			})
		);
		expect(setAttribute).toHaveBeenCalledWith('error_category', 'user');
		expect(setStatus).toHaveBeenCalled();
	});

	it('end() es idempotente', () => {
		const handle = startJourney('auth.login');
		handle.end('success');
		handle.end('failure', { error_category: 'operational' });
		expect(add).toHaveBeenCalledTimes(1);
		expect(spanEnd).toHaveBeenCalledTimes(1);
	});

	it('getCurrentJourneyContext() retorna null si no hay journey activo', () => {
		expect(getCurrentJourneyContext()).toBeNull();
	});

	it('getCurrentJourneyContext() retorna el contexto tras startJourney', () => {
		const handle = startJourney('auth.login');
		const ctx = getCurrentJourneyContext();
		expect(ctx).toMatchObject({
			name: 'auth.login',
			traceId: handle.traceId,
			spanId: handle.spanId
		});
		handle.end('success');
		expect(getCurrentJourneyContext()).toBeNull();
	});

	it('si startJourney falla, el handle retornado no throw en .end()', () => {
		startSpan.mockImplementation(() => {
			throw new Error('tracer down');
		});
		const handle = startJourney('auth.login');
		expect(() => handle.end('success')).not.toThrow();
	});

	it('outcome inválido se normaliza a failure', () => {
		for (const outcome of ['success', 'failure', 'cancelled', 'timeout']) {
			add.mockClear();
			startJourney('checkout.complete').end(outcome);
			expect(add.mock.calls[0][1].outcome).toBe(outcome);
		}
		add.mockClear();
		startJourney('checkout.complete').end('nope');
		expect(add.mock.calls[0][1].outcome).toBe('failure');
		add.mockClear();
		startJourney('checkout.complete').end(undefined);
		expect(add.mock.calls[0][1].outcome).toBe('failure');
	});

	it('continúa el trace_id del parentContext', () => {
		const parent = { traceId: 'f'.repeat(32), spanId: 'e'.repeat(16), traceFlags: 1 };
		startJourney('auth.login', parent);
		expect(startSpan).toHaveBeenCalled();
		const ctx = startSpan.mock.calls[0][2];
		expect(ctx).toBeTruthy();
	});

	it('nombre vacío se normaliza a unknown', () => {
		startJourney('   ').end('success');
		expect(add.mock.calls[0][1].journey).toBe('unknown');
	});

	it('recordJourneyOutcome y recordJsError no throw', () => {
		expect(() => recordJourneyOutcome({ journey: 'x', outcome: 'success' })).not.toThrow();
		expect(() => recordJsError({ errorCategory: 'programming' })).not.toThrow();
		expect(add).toHaveBeenCalled();
	});

	it('fail-open si el meter throw', () => {
		vi.spyOn(metrics, 'getMeter').mockImplementation(() => {
			throw new Error('meter down');
		});
		expect(() => recordJourneyOutcome({ journey: 'x' })).not.toThrow();
		expect(() => recordJsError()).not.toThrow();
		const handle = startJourney('auth.login');
		expect(() => handle.end('success')).not.toThrow();
	});
});

describe('journey en SSR', () => {
	it('no guarda el journey activo cuando no hay window', async () => {
		vi.resetModules();
		const original = globalThis.window;
		// @ts-expect-error simulamos SSR
		delete globalThis.window;
		try {
			const { startJourney, getCurrentJourneyContext } =
				await import('../../src/lib/observability/journey.js');
			startJourney('auth.login');

			// En SSR este módulo lo comparten todas las peticiones a la vez: guardar
			// aquí el journey haría que una viera el de otra.
			expect(getCurrentJourneyContext()).toBeNull();
		} finally {
			globalThis.window = original;
			vi.resetModules();
		}
	});
});
