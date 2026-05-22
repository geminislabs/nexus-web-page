import { writable } from 'svelte/store';
import { browser } from '$app/environment';

const LS_TOKEN = 'token';
const LS_REFRESH = 'refresh_token';
const LS_ID = 'id_token';
const LS_EXPIRES_AT = 'token_expires_at';

/** @param {string | null | undefined} token */
function readJwtExpiryMs(token) {
	if (!token || typeof token !== 'string') return null;
	const parts = token.split('.');
	if (parts.length < 2) return null;
	try {
		const payload = JSON.parse(atob(parts[1].replace(/-/g, '+').replace(/_/g, '/')));
		if (typeof payload.exp === 'number') return payload.exp * 1000;
	} catch {
		return null;
	}
	return null;
}

function createAuthStore() {
	const { subscribe, set } = writable(null);

	return {
		subscribe,

		login: (userData) => {
			set(userData);
			if (browser) {
				localStorage.setItem('user', JSON.stringify(userData));
			}
		},
		logout: () => {
			set(null);
			if (browser) {
				localStorage.removeItem('user');
				localStorage.removeItem(LS_TOKEN);
				localStorage.removeItem(LS_REFRESH);
				localStorage.removeItem(LS_ID);
				localStorage.removeItem(LS_EXPIRES_AT);
			}
		},

		init: () => {
			if (!browser) return;

			const userData = localStorage.getItem('user');
			if (userData) {
				try {
					set(JSON.parse(userData));
				} catch {
					set(null);
				}
			}
		}
	};
}

export const user = createAuthStore();

function createTokenStore() {
	const { subscribe, set } = writable(null);

	/** @param {string | null | undefined} accessToken */
	function persistAccessToken(accessToken) {
		set(accessToken ?? null);
		if (!browser) return;
		if (accessToken) localStorage.setItem(LS_TOKEN, accessToken);
		else localStorage.removeItem(LS_TOKEN);
	}

	return {
		subscribe,
		setToken: (token) => {
			persistAccessToken(token);
		},
		getToken: () => {
			if (!browser) return null;
			return localStorage.getItem(LS_TOKEN);
		},
		getRefreshToken: () => {
			if (!browser) return null;
			return localStorage.getItem(LS_REFRESH);
		},
		getIdToken: () => {
			if (!browser) return null;
			return localStorage.getItem(LS_ID);
		},
		/**
		 * Persiste tokens tras login o refresh.
		 * @param {{ access_token?: string, refresh_token?: string, id_token?: string, expires_in?: number }} session
		 */
		setSession: (session) => {
			if (!session) return;
			if (session.access_token) persistAccessToken(session.access_token);
			if (browser) {
				if (session.refresh_token) localStorage.setItem(LS_REFRESH, session.refresh_token);
				if (session.id_token) localStorage.setItem(LS_ID, session.id_token);
				if (typeof session.expires_in === 'number') {
					localStorage.setItem(LS_EXPIRES_AT, String(Date.now() + session.expires_in * 1000));
				} else if (session.access_token) {
					const jwtExp = readJwtExpiryMs(session.access_token);
					if (jwtExp) localStorage.setItem(LS_EXPIRES_AT, String(jwtExp));
				}
			}
		},
		/**
		 * @param {number} [thresholdSeconds=300]
		 */
		isTokenExpiringSoon: (thresholdSeconds = 300) => {
			if (!browser) return false;
			const token = localStorage.getItem(LS_TOKEN);
			if (!token) return false;

			const stored = localStorage.getItem(LS_EXPIRES_AT);
			const expiresAt = stored ? Number(stored) : readJwtExpiryMs(token);
			if (!expiresAt || Number.isNaN(expiresAt)) return false;

			return Date.now() + thresholdSeconds * 1000 >= expiresAt;
		},
		clearToken: () => {
			set(null);
			if (browser) {
				localStorage.removeItem(LS_TOKEN);
				localStorage.removeItem(LS_REFRESH);
				localStorage.removeItem(LS_ID);
				localStorage.removeItem(LS_EXPIRES_AT);
			}
		},
		init: () => {
			if (!browser) return;
			const token = localStorage.getItem(LS_TOKEN);
			if (token) set(token);
		}
	};
}

export const authToken = createTokenStore();
