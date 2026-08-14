import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ApiError } from '../src/lib/services/apiErrors.js';

vi.mock('$app/environment', () => ({ browser: true }));

const apiMocks = vi.hoisted(() => ({
	logout: vi.fn().mockResolvedValue(null),
	getCurrentUser: vi.fn().mockResolvedValue({ email: 'a@b.com', full_name: 'Ana' })
}));

vi.mock('../src/lib/services/api.js', () => ({
	apiService: {
		logout: apiMocks.logout,
		getCurrentUser: apiMocks.getCurrentUser
	}
}));

describe('apiErrors', () => {
	it('ApiError expone detail de auth seguro', () => {
		const err = new ApiError('HTTP error', { status: 403, detail: 'Email no verificado' });
		expect(err.displayMessage).toBe('Email no verificado');
	});
});

describe('sessionService', () => {
	beforeEach(() => {
		vi.resetModules();
		localStorage.getItem.mockReturnValue(null);
		localStorage.setItem.mockClear();
		localStorage.removeItem.mockClear();
		apiMocks.logout.mockClear();
		apiMocks.getCurrentUser.mockClear();
	});

	it('normalizeUser unifica nombre y rol master', async () => {
		const { normalizeUser } = await import('../src/lib/services/sessionService.js');
		expect(normalizeUser({ full_name: 'Ana', role: 'master' })).toMatchObject({
			name: 'Ana',
			is_master: true
		});
	});

	it('getRecoverPasswordUrl usa VITE_COMPANY_URL', async () => {
		vi.stubEnv('VITE_COMPANY_URL', 'https://geminis.dev');
		const { getRecoverPasswordUrl } = await import('../src/lib/services/sessionService.js');
		expect(getRecoverPasswordUrl()).toBe('https://geminis.dev/auth?mode=recover');
		vi.unstubAllEnvs();
	});

	it('getRecoverPasswordUrl devuelve null sin URL configurada', async () => {
		vi.stubEnv('VITE_COMPANY_URL', '');
		const { getRecoverPasswordUrl } = await import('../src/lib/services/sessionService.js');
		expect(getRecoverPasswordUrl()).toBeNull();
		vi.unstubAllEnvs();
	});

	it('persistLoginResponse stores session and user profile', async () => {
		const { persistLoginResponse } = await import('../src/lib/services/sessionService.js');
		persistLoginResponse({
			access_token: 'at',
			refresh_token: 'rt',
			expires_in: 3600,
			user: { full_name: 'Ana', role: 'master' }
		});
		expect(localStorage.setItem).toHaveBeenCalled();
	});

	it('logoutSession clears local session even if API fails', async () => {
		const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
		localStorage.getItem.mockImplementation((key) => (key === 'token' ? 'tok' : null));
		apiMocks.logout.mockRejectedValueOnce(new Error('network'));
		const { logoutSession } = await import('../src/lib/services/sessionService.js');
		await logoutSession();
		expect(localStorage.removeItem).toHaveBeenCalled();
		expect(warn).toHaveBeenCalled();
		warn.mockRestore();
	});

	it('validateSessionWithApi returns false without token', async () => {
		const { validateSessionWithApi } = await import('../src/lib/services/sessionService.js');
		await expect(validateSessionWithApi()).resolves.toBe(false);
	});

	it('validateSessionWithApi hydrates user when API succeeds', async () => {
		localStorage.getItem.mockImplementation((key) => (key === 'token' ? 'tok' : null));
		const { validateSessionWithApi } = await import('../src/lib/services/sessionService.js');
		await expect(validateSessionWithApi()).resolves.toBe(true);
		expect(apiMocks.getCurrentUser).toHaveBeenCalled();
	});

	it('validateSessionWithApi clears session when API fails', async () => {
		const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
		localStorage.getItem.mockImplementation((key) => (key === 'token' ? 'tok' : null));
		apiMocks.getCurrentUser.mockRejectedValueOnce(new Error('401'));
		const { validateSessionWithApi } = await import('../src/lib/services/sessionService.js');
		await expect(validateSessionWithApi()).resolves.toBe(false);
		expect(warn).toHaveBeenCalled();
		warn.mockRestore();
	});
});
