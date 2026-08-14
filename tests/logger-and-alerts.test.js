import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { formatTripAlertType, tripAlertMarkerColor } from '../src/lib/utils/tripAlertFormat.js';
import {
	logger,
	scrubPiiString,
	scrubContext,
	createRequestId,
	setObservabilitySink,
	setRequestIdProvider
} from '../src/lib/utils/logger.js';

describe('tripAlertFormat', () => {
	it('humaniza UNKNOWN_ALERT y tipos conocidos', () => {
		expect(formatTripAlertType('UNKNOWN_ALERT')).toBe('Alerta');
		expect(formatTripAlertType('speeding')).toBe('Exceso de velocidad');
		expect(formatTripAlertType('')).toBe('Alerta');
	});

	it('formatea snake_case desconocido', () => {
		expect(formatTripAlertType('custom_event_type')).toBe('Custom Event Type');
	});

	it('colorea marcadores de ignición', () => {
		expect(tripAlertMarkerColor('ignition_on')).toBe('#22c55e');
		expect(tripAlertMarkerColor('ignition_off')).toBe('#f97316');
		expect(tripAlertMarkerColor('speeding')).toBe('#f59e0b');
	});
});

describe('logger', () => {
	/** @type {ReturnType<typeof vi.spyOn>[]} */
	let consoleSpies = [];

	beforeEach(() => {
		setObservabilitySink(null);
		setRequestIdProvider(null);
		consoleSpies = ['debug', 'info', 'warn', 'error'].map((level) =>
			vi.spyOn(console, level).mockImplementation(() => {})
		);
	});

	afterEach(() => {
		setObservabilitySink(null);
		setRequestIdProvider(null);
		consoleSpies.forEach((s) => s.mockRestore());
	});

	it('scrubPiiString redacts bearer and jwt-like strings', () => {
		expect(scrubPiiString('Bearer abc.def.ghi')).toContain('[REDACTED]');
		expect(scrubPiiString('eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxIn0.sig')).toContain('[REDACTED]');
	});

	it('scrubContext redacts token and email keys', () => {
		const scrubbed = scrubContext({
			token: 'secret',
			email: 'a@b.com',
			deviceCount: 2,
			ok: true
		});
		expect(scrubbed.token).toBe('[REDACTED]');
		expect(scrubbed.email).toBe('[REDACTED]');
		expect(scrubbed.deviceCount).toBe(2);
		expect(scrubbed.ok).toBe(true);
	});

	it('createRequestId returns a non-empty id', () => {
		expect(createRequestId().length).toBeGreaterThan(8);
	});

	it('forwards warn/error events to observability sink', () => {
		const sink = vi.fn();
		setObservabilitySink(sink);
		setRequestIdProvider(() => 'req-test-123');

		logger.error({
			code: 'TEST_CODE',
			message: 'boom',
			err: new Error('Bearer leak-token'),
			context: { password: 'x', status: 500 }
		});

		expect(sink).toHaveBeenCalledOnce();
		const event = sink.mock.calls[0][0];
		expect(event.level).toBe('error');
		expect(event.code).toBe('TEST_CODE');
		expect(event.requestId).toBe('req-test-123');
		expect(event.detail).toContain('[REDACTED]');
		expect(event.context.password).toBe('[REDACTED]');
		expect(event.context.status).toBe(500);
	});
});
