import { describe, it, expect, vi } from 'vitest';
import { ApiError } from '../src/lib/services/apiErrors.js';
import { normalizeUser, getRecoverPasswordUrl } from '../src/lib/services/sessionService.js';

describe('apiErrors', () => {
	it('ApiError expone detail del backend', () => {
		const err = new ApiError('HTTP error', { status: 403, detail: 'Email no verificado' });
		expect(err.displayMessage).toBe('Email no verificado');
	});
});

describe('sessionService', () => {
	it('normalizeUser unifica nombre y rol master', () => {
		expect(normalizeUser({ full_name: 'Ana', role: 'master' })).toMatchObject({
			name: 'Ana',
			is_master: true
		});
	});

	it('getRecoverPasswordUrl usa VITE_COMPANY_URL', () => {
		vi.stubEnv('VITE_COMPANY_URL', 'https://geminis.dev');
		expect(getRecoverPasswordUrl()).toBe('https://geminis.dev/auth?mode=recover');
		vi.unstubAllEnvs();
	});

	it('getRecoverPasswordUrl devuelve null sin URL configurada', () => {
		vi.stubEnv('VITE_COMPANY_URL', '');
		expect(getRecoverPasswordUrl()).toBeNull();
		vi.unstubAllEnvs();
	});
});
