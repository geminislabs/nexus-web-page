import { describe, it, expect, vi, afterEach } from 'vitest';
import { logs } from '@opentelemetry/api-logs';
import { logger, setObservabilitySink } from '../../src/lib/utils/logger.js';
import { init } from '../../src/lib/observability/index.js';

describe('logger sink', () => {
	afterEach(() => {
		setObservabilitySink(null);
		vi.unstubAllEnvs();
		vi.restoreAllMocks();
	});

	it('init reenvía logger.error ya sin token, email ni coordenadas', async () => {
		vi.stubEnv('OTLP_ENDPOINT', '');
		const emit = vi.fn();
		vi.spyOn(logs, 'getLogger').mockReturnValue({ emit });
		vi.spyOn(console, 'error').mockImplementation(() => {});

		await init();
		logger.error({
			code: 'AUTH_REFRESH_FAILED',
			message: 'Token refresh failed',
			context: { token: 'secret-token', lat: 19.4, lng: -99.1, email: 'ada@example.com' }
		});

		expect(emit).toHaveBeenCalled();
		const payload = JSON.stringify(emit.mock.calls);
		expect(payload).toContain('AUTH_REFRESH_FAILED');
		expect(payload).not.toContain('secret-token');
		expect(payload).not.toContain('ada@example.com');
		expect(payload).not.toContain('19.4');
		expect(payload).not.toContain('-99.1');
	});
});
