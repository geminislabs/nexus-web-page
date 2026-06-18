import { describe, it, expect, vi, beforeEach } from 'vitest';
import { get } from 'svelte/store';

vi.mock('$app/environment', () => ({ browser: true }));

describe('auth stores', () => {
	beforeEach(() => {
		vi.resetModules();
		localStorage.getItem.mockReturnValue(null);
		localStorage.setItem.mockClear();
		localStorage.removeItem.mockClear();
	});

	it('user.init hydrates from localStorage', async () => {
		localStorage.getItem.mockImplementation((key) =>
			key === 'user' ? JSON.stringify({ name: 'Ana' }) : null
		);
		const { user } = await import('../src/lib/stores/auth.js');
		user.init();
		expect(get(user)).toEqual({ name: 'Ana' });
	});

	it('user.login persists profile', async () => {
		const { user } = await import('../src/lib/stores/auth.js');
		user.login({ name: 'Bob' });
		expect(get(user)).toEqual({ name: 'Bob' });
		expect(localStorage.setItem).toHaveBeenCalledWith('user', JSON.stringify({ name: 'Bob' }));
	});

	it('user.logout clears storage keys', async () => {
		const { user } = await import('../src/lib/stores/auth.js');
		user.login({ name: 'Bob' });
		user.logout();
		expect(get(user)).toBeNull();
		expect(localStorage.removeItem).toHaveBeenCalledWith('user');
	});

	it('authToken.setSession persists access and refresh tokens', async () => {
		const { authToken } = await import('../src/lib/stores/auth.js');
		const payload = btoa(JSON.stringify({ exp: Math.floor(Date.now() / 1000) + 3600 }));
		authToken.setSession({
			access_token: `h.${payload}.s`,
			refresh_token: 'refresh',
			id_token: 'id',
			expires_in: 3600
		});
		expect(localStorage.setItem).toHaveBeenCalledWith('token', expect.stringContaining('h.'));
		expect(localStorage.setItem).toHaveBeenCalledWith('refresh_token', 'refresh');
		expect(localStorage.setItem).toHaveBeenCalledWith('id_token', 'id');
	});

	it('authToken.isTokenExpiringSoon detects near expiry', async () => {
		const { authToken } = await import('../src/lib/stores/auth.js');
		const soon = String(Date.now() + 60_000);
		localStorage.getItem.mockImplementation((key) => {
			if (key === 'token') return 'tok';
			if (key === 'token_expires_at') return soon;
			return null;
		});
		expect(authToken.isTokenExpiringSoon(300)).toBe(true);
	});

	it('authToken.init hydrates token from storage', async () => {
		localStorage.getItem.mockImplementation((key) => (key === 'token' ? 'stored-tok' : null));
		const { authToken } = await import('../src/lib/stores/auth.js');
		authToken.init();
		expect(localStorage.getItem).toHaveBeenCalledWith('token');
	});

	it('authToken exposes id token and clearToken', async () => {
		localStorage.getItem.mockImplementation((key) => {
			if (key === 'id_token') return 'id-tok';
			return null;
		});
		const { authToken } = await import('../src/lib/stores/auth.js');
		expect(authToken.getIdToken()).toBe('id-tok');
		authToken.clearToken();
		expect(localStorage.removeItem).toHaveBeenCalledWith('token');
	});

	it('user.init ignores invalid JSON in storage', async () => {
		localStorage.getItem.mockImplementation((key) => (key === 'user' ? '{bad' : null));
		const { user } = await import('../src/lib/stores/auth.js');
		user.init();
		expect(get(user)).toBeNull();
	});
});
